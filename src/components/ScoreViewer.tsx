import { useState, useEffect } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import type { User } from '@supabase/supabase-js'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import AnnotationCanvas from './AnnotationCanvas'
import { getOfflinePdf } from '../utils/pdfCache'

import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

interface ScoreViewerProps {
  user: User
  partId: string
  fileUrl: string
  title: string
  role: string
  canEditSection: boolean
  onClose: () => void
}

const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#000000', '#ffffff']

export default function ScoreViewer({ user, partId, fileUrl, title, role, canEditSection, onClose }: ScoreViewerProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState(1)
  const [localPdfUrl, setLocalPdfUrl] = useState<string | null>(null)

  // Drawing State
  const [activeTool, setActiveTool] = useState<'pen' | 'highlighter' | 'eraser' | 'stamp' | 'none'>('none')
  const [activeColor, setActiveColor] = useState('#ef4444')
  const [activeLayer, setActiveLayer] = useState<'personal' | 'section' | 'director'>('personal')
  const [activeStamp, setActiveStamp] = useState('upbow')
  const [undoTrigger, setUndoTrigger] = useState(0)

  // Single Visibility State
  const [visibleLayer, setVisibleLayer] = useState<'personal' | 'section' | 'director'>('personal')

  useEffect(() => {
    let isMounted = true
    const loadPdf = async () => {
      const offlineUrl = await getOfflinePdf(partId, fileUrl)
      if (isMounted) setLocalPdfUrl(offlineUrl)
    }
    loadPdf()
    return () => { isMounted = false }
  }, [partId, fileUrl])

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    setPageNumber(1)
  }

  // SMART SYNC: If they switch drawing layers, automatically view that layer.
  const handleSetDrawLayer = (layer: 'personal' | 'section' | 'director') => {
    setActiveLayer(layer)
    setVisibleLayer(layer)
  }

  // SMART SYNC: If they switch views, try to match the draw tool. If they don't have permission, lock to View mode.
  const handleSetViewingLayer = (layer: 'personal' | 'section' | 'director') => {
    setVisibleLayer(layer)
    
    if (layer === 'director' && role === 'director') {
      setActiveLayer('director')
    } else if (layer === 'section' && canEditSection) {
      setActiveLayer('section')
    } else if (layer === 'personal') {
      setActiveLayer('personal')
    } else {
      setActiveTool('none') // Put away the pen!
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-950 flex flex-col z-50">
      
      {/* Sleek Top Navigation Bar */}
      <div className="absolute top-0 inset-x-0 z-20 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800/50 flex items-center justify-between px-4 py-3 shadow-lg">
        <div className="flex-1">
          <h2 className="text-white font-bold tracking-wide truncate">{title}</h2>
        </div>
        
        {/* Massive Tablet-Friendly Page Controls */}
        <div className="flex-1 flex items-center justify-center gap-6">
          <button 
            onClick={() => setPageNumber(prev => Math.max(1, prev - 1))} 
            disabled={pageNumber <= 1} 
            className="w-12 h-12 flex items-center justify-center bg-slate-800/80 hover:bg-slate-700 text-white rounded-full transition active:scale-95 disabled:opacity-30"
          >
            <span className="text-xl font-bold">←</span>
          </button>
          
          <div className="flex flex-col items-center min-w-[80px]">
            <span className="text-lg text-white font-bold">{pageNumber}</span>
            <span className="text-[10px] text-slate-400 font-medium uppercase tracking-widest -mt-1">of {numPages || '-'}</span>
          </div>

          <button 
            onClick={() => setPageNumber(prev => Math.min(numPages, prev + 1))} 
            disabled={pageNumber >= numPages} 
            className="w-12 h-12 flex items-center justify-center bg-slate-800/80 hover:bg-slate-700 text-white rounded-full transition active:scale-95 disabled:opacity-30"
          >
            <span className="text-xl font-bold">→</span>
          </button>
        </div>

        <div className="flex-1 flex justify-end">
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center bg-slate-800/50 hover:bg-rose-500/20 hover:text-rose-400 text-slate-300 rounded-full transition">
            ✕
          </button>
        </div>
      </div>

      {/* Floating Toolbar (Apple Pencil Style) */}
      <div className="absolute top-20 inset-x-0 z-20 flex justify-center pointer-events-none">
        <div className="bg-slate-900/90 backdrop-blur-2xl border border-slate-700/50 shadow-2xl p-2 rounded-2xl flex flex-wrap items-center gap-4 pointer-events-auto transition-all">
          
          {/* Tool Selector */}
          <div className="flex items-center gap-1 bg-slate-950/50 p-1 rounded-xl border border-slate-800">
            <button onClick={() => setActiveTool('none')} className={`w-10 h-10 flex items-center justify-center text-lg rounded-lg transition ${activeTool === 'none' ? 'bg-indigo-500 text-white shadow-md scale-105' : 'text-slate-400 hover:bg-slate-800'}`} title="Pan / View">✋</button>
            <button onClick={() => setActiveTool('pen')} className={`w-10 h-10 flex items-center justify-center text-lg rounded-lg transition ${activeTool === 'pen' ? 'bg-indigo-500 text-white shadow-md scale-105' : 'text-slate-400 hover:bg-slate-800'}`} title="Pen">✏️</button>
            <button onClick={() => setActiveTool('highlighter')} className={`w-10 h-10 flex items-center justify-center text-lg rounded-lg transition ${activeTool === 'highlighter' ? 'bg-indigo-500 text-white shadow-md scale-105' : 'text-slate-400 hover:bg-slate-800'}`} title="Highlighter">🖍️</button>
            <button onClick={() => setActiveTool('stamp')} className={`w-10 h-10 flex items-center justify-center text-lg rounded-lg transition ${activeTool === 'stamp' ? 'bg-indigo-500 text-white shadow-md scale-105' : 'text-slate-400 hover:bg-slate-800'}`} title="Music Stamps">🎵</button>
            <div className="w-px h-6 bg-slate-800 mx-1"></div>
            <button onClick={() => setActiveTool('eraser')} className={`w-10 h-10 flex items-center justify-center text-lg rounded-lg transition ${activeTool === 'eraser' ? 'bg-rose-500 text-white shadow-md scale-105' : 'text-slate-400 hover:bg-slate-800'}`} title="Eraser">🧽</button>
            <button onClick={() => setUndoTrigger(prev => prev + 1)} className="w-10 h-10 flex items-center justify-center text-lg rounded-lg text-slate-400 hover:bg-slate-800 active:scale-90 transition" title="Undo Last Stroke">↩️</button>
          </div>

          {/* Contextual Settings (Only shows when drawing) */}
          {activeTool !== 'none' && activeTool !== 'eraser' && (
            <div className="flex items-center gap-3 pl-2 border-l border-slate-700/50">
              {activeTool === 'stamp' ? (
                <select value={activeStamp} onChange={e => setActiveStamp(e.target.value)} className="bg-slate-950 border border-slate-700 text-sm text-white font-medium rounded-lg p-2 outline-none shadow-inner cursor-pointer focus:border-indigo-500 transition">
                  <option value="upbow">⋁ Up-Bow</option>
                  <option value="downbow">⊓ Down-Bow</option>
                  <option value="breath">’ Breath</option>
                  <option value="caesura">// Caesura</option>
                  <option value="accent">&gt; Accent</option>
                </select>
              ) : (
                <div className="flex items-center gap-1.5">
                  {COLORS.map(c => (
                    <button 
                      key={c} onClick={() => setActiveColor(c)} style={{ backgroundColor: c }}
                      className={`w-7 h-7 rounded-full transition-transform ${activeColor === c ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110 shadow-lg' : 'opacity-70 hover:opacity-100 hover:scale-105'}`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Target Layer Selector */}
          {activeTool !== 'none' && (
            <div className="flex items-center gap-1 pl-4 pr-1 border-l border-slate-700/50">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mr-2">Draw To</span>
              <button onClick={() => handleSetDrawLayer('personal')} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${activeLayer === 'personal' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-slate-400 hover:bg-slate-800'}`}>Private</button>
              {canEditSection && <button onClick={() => handleSetDrawLayer('section')} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${activeLayer === 'section' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-slate-400 hover:bg-slate-800'}`}>Section</button>}
              {role === 'director' && <button onClick={() => handleSetDrawLayer('director')} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${activeLayer === 'director' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'text-slate-400 hover:bg-slate-800'}`}>Director</button>}
            </div>
          )}
        </div>
      </div>

      {/* Single View Selector (Bottom Right) */}
      <div className="absolute bottom-6 right-6 z-20 flex flex-col gap-1 bg-slate-900/90 backdrop-blur-md border border-slate-700 p-2 rounded-2xl shadow-2xl">
        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider text-center mb-1">Viewing</p>
        <button onClick={() => handleSetViewingLayer('director')} className={`w-28 px-3 py-2 rounded-xl transition ${visibleLayer === 'director' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
          <span className="text-xs font-bold">Director</span>
        </button>
        <button onClick={() => handleSetViewingLayer('section')} className={`w-28 px-3 py-2 rounded-xl transition ${visibleLayer === 'section' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
          <span className="text-xs font-bold">Section</span>
        </button>
        <button onClick={() => handleSetViewingLayer('personal')} className={`w-28 px-3 py-2 rounded-xl transition ${visibleLayer === 'personal' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
          <span className="text-xs font-bold">Private</span>
        </button>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 overflow-hidden bg-slate-950 flex justify-center items-center pt-20">
        {!localPdfUrl ? (
          <div className="flex flex-col items-center justify-center gap-4 animate-pulse">
            <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
            <p className="text-indigo-400 font-medium tracking-wide">Downloading score...</p>
          </div>
        ) : (
          <TransformWrapper initialScale={1} minScale={0.5} maxScale={4} centerOnInit={true} wheel={{ step: 0.1 }} panning={{ disabled: activeTool !== 'none', velocityDisabled: true }} doubleClick={{ disabled: true }}>
            {() => (
              <TransformComponent wrapperClass="w-full h-full cursor-grab active:cursor-grabbing">
                <Document file={localPdfUrl} onLoadSuccess={onDocumentLoadSuccess} loading={null}>
                  <div className="relative shadow-[0_0_50px_rgba(0,0,0,0.5)] bg-white mt-12 mb-20 mx-4">
                    <Page pageNumber={pageNumber} scale={1.5} className="rounded overflow-hidden" renderAnnotationLayer={false} renderTextLayer={false} />
                    <AnnotationCanvas partId={partId} pageNumber={pageNumber} activeTool={activeTool} activeColor={activeColor} activeLayer={activeLayer} activeStamp={activeStamp} undoTrigger={undoTrigger} user={user} visibleLayer={visibleLayer} />
                  </div>
                </Document>
              </TransformComponent>
            )}
          </TransformWrapper>
        )}
      </div>
    </div>
  )
}