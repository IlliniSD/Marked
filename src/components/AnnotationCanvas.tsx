import { useState, useEffect, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { supabase } from '../supabase'
import type { User } from '@supabase/supabase-js'

interface Point { x: number; y: number }
interface Line {
  id?: string
  points: Point[]
  color: string
  width: number
  tool: string
  layer_type: string
  author_id: string
  stamp_type?: string
}

interface AnnotationCanvasProps {
  partId: string
  pageNumber: number
  activeTool: 'pen' | 'highlighter' | 'eraser' | 'stamp' | 'none'
  activeColor: string
  activeLayer: 'personal' | 'section' | 'director'
  activeStamp: string
  undoTrigger: number
  user: User
  visibleLayer: 'personal' | 'section' | 'director'
}

const STAMP_MAP: Record<string, string> = {
  upbow: '⋁',
  downbow: '⊓',
  breath: '’',
  caesura: '//',
  accent: '>',
}

export default function AnnotationCanvas({ 
  partId, pageNumber, activeTool, activeColor, activeLayer, activeStamp, undoTrigger, user, visibleLayer 
}: AnnotationCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [lines, setLines] = useState<Line[]>([])
  const [currentLine, setCurrentLine] = useState<Line | null>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  // Screen resizing math
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight })
      }
    }
    updateSize()
    const timeout = setTimeout(updateSize, 500)
    window.addEventListener('resize', updateSize)
    return () => { clearTimeout(timeout); window.removeEventListener('resize', updateSize) }
  }, [pageNumber])

  // Fetch initial data AND subscribe to live Realtime updates
  useEffect(() => {
    const fetchAnnotations = async () => {
      const { data } = await supabase.from('part_annotations').select('*').eq('part_id', partId).eq('page_number', pageNumber)
      if (data) {
        setLines(data.map(row => ({
          id: row.id, points: row.points as Point[], color: row.color, width: row.stroke_width,
          tool: row.tool_type, layer_type: row.layer_type, author_id: row.author_id, stamp_type: row.stamp_type
        })))
      }
    }
    fetchAnnotations()

    const channel = supabase.channel(`part_annotations_${partId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'part_annotations', filter: `part_id=eq.${partId}` }, payload => {
        if (payload.new.page_number === pageNumber && payload.new.author_id !== user.id) {
          setLines(prev => {
            if (prev.some(l => l.id === payload.new.id)) return prev
            return [...prev, {
              id: payload.new.id, points: payload.new.points, color: payload.new.color, width: payload.new.stroke_width,
              tool: payload.new.tool_type, layer_type: payload.new.layer_type, author_id: payload.new.author_id, stamp_type: payload.new.stamp_type
            }]
          })
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'part_annotations', filter: `part_id=eq.${partId}` }, payload => {
        setLines(prev => prev.filter(l => l.id !== payload.old.id))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [partId, pageNumber, user.id])

  // Undo Functionality triggered via prop
  useEffect(() => {
    if (undoTrigger > 0) {
      const handleUndo = async () => {
        const myLines = lines.filter(l => l.author_id === user.id && l.layer_type === activeLayer)
        if (!myLines.length) return
        const lastLine = myLines[myLines.length - 1]
        if (!lastLine.id) return
        
        setLines(prev => prev.filter(l => l.id !== lastLine.id))
        await supabase.from('part_annotations').delete().eq('id', lastLine.id)
      }
      handleUndo()
    }
  }, [undoTrigger, user.id, activeLayer, lines])

  const getPoint = (e: ReactPointerEvent<HTMLDivElement>): Point | null => {
    if (!containerRef.current) return null
    const rect = containerRef.current.getBoundingClientRect()
    return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height }
  }

  // Eraser collision detection
  const eraseAtPoint = async (pt: Point) => {
    const hit = lines.find(line => {
      if (line.layer_type !== activeLayer) return false
      if (line.author_id !== user.id && activeLayer === 'personal') return false
      return line.points.some(p => Math.hypot(p.x - pt.x, p.y - pt.y) < 0.03) // Collision radius
    })
    if (hit && hit.id) {
      setLines(prev => prev.filter(l => l.id !== hit.id))
      await supabase.from('part_annotations').delete().eq('id', hit.id)
    }
  }

  const handlePointerDown = async (e: ReactPointerEvent<HTMLDivElement>) => {
    if (activeTool === 'none') return
    const pt = getPoint(e)
    if (!pt) return
    e.currentTarget.setPointerCapture(e.pointerId)

    if (activeTool === 'eraser') {
      await eraseAtPoint(pt)
      return
    }

    if (activeTool === 'stamp') {
      const tempId = `temp-${Date.now()}`
      const newLine: Line = { id: tempId, points: [pt], color: activeColor, width: 2.5, tool: 'stamp', stamp_type: activeStamp, layer_type: activeLayer, author_id: user.id }
      setLines(prev => [...prev, newLine])
      
      const { data } = await supabase.from('part_annotations').insert({
        part_id: partId, page_number: pageNumber, author_id: user.id, layer_type: newLine.layer_type,
        tool_type: newLine.tool, color: newLine.color, stroke_width: newLine.width, points: newLine.points, stamp_type: newLine.stamp_type
      }).select().single()
      
      if (data) setLines(prev => prev.map(l => l.id === tempId ? { ...l, id: data.id } : l))
      return
    }

    setCurrentLine({ points: [pt], color: activeColor, width: activeTool === 'highlighter' ? 15 : 2.5, tool: activeTool, layer_type: activeLayer, author_id: user.id })
  }

  const handlePointerMove = async (e: ReactPointerEvent<HTMLDivElement>) => {
    if (activeTool === 'none') return
    const pt = getPoint(e)
    if (!pt) return

    if (activeTool === 'eraser' && e.buttons === 1) {
      await eraseAtPoint(pt)
      return
    }

    if (currentLine && (activeTool === 'pen' || activeTool === 'highlighter')) {
      setCurrentLine(prev => prev ? { ...prev, points: [...prev.points, pt] } : null)
    }
  }

  const handlePointerUp = async (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!currentLine || activeTool === 'none' || activeTool === 'eraser' || activeTool === 'stamp') return
    e.currentTarget.releasePointerCapture(e.pointerId)

    const tempId = `temp-${Date.now()}`
    const finalLine = { ...currentLine, id: tempId }
    setLines(prev => [...prev, finalLine])
    setCurrentLine(null)

    const { data } = await supabase.from('part_annotations').insert({
      part_id: partId, page_number: pageNumber, author_id: user.id, layer_type: finalLine.layer_type,
      tool_type: finalLine.tool, color: finalLine.color, stroke_width: finalLine.width, points: finalLine.points
    }).select().single()

    if (data) setLines(prev => prev.map(l => l.id === tempId ? { ...l, id: data.id } : l))
  }

  const pointsToPath = (points: Point[]) => {
    if (!points.length || dimensions.width === 0) return ''
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x * dimensions.width} ${p.y * dimensions.height}`).join(' ')
  }

  // ONLY SHOW THE CURRENTLY SELECTED LAYER
  const visibleLines = lines.filter(line => line.layer_type === visibleLayer)

  return (
    <div 
      ref={containerRef}
      className={`absolute inset-0 z-10 ${activeTool === 'pen' || activeTool === 'highlighter' ? 'cursor-crosshair' : activeTool === 'eraser' ? 'cursor-not-allowed' : activeTool === 'stamp' ? 'cursor-pointer' : ''}`}
      style={{ touchAction: 'none' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <svg className="w-full h-full pointer-events-none">
        {visibleLines.map((line, idx) => {
          if (line.tool === 'stamp' && line.stamp_type) {
            const p = line.points[0]
            if (!p) return null
            return (
              <text key={line.id || idx} x={p.x * dimensions.width} y={p.y * dimensions.height} fill={line.color} fontSize="28" fontWeight="bold" fontFamily="serif" textAnchor="middle" dominantBaseline="central">
                {STAMP_MAP[line.stamp_type] || line.stamp_type}
              </text>
            )
          }
          return (
            <path key={line.id || idx} d={pointsToPath(line.points)} stroke={line.color} strokeWidth={line.width} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={line.tool === 'highlighter' ? 0.4 : 1} />
          )
        })}
        {currentLine && (
          <path d={pointsToPath(currentLine.points)} stroke={currentLine.color} strokeWidth={currentLine.width} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={currentLine.tool === 'highlighter' ? 0.4 : 1} />
        )}
      </svg>
    </div>
  )
}