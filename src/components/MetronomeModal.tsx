import { useState, useEffect, useRef } from 'react'

interface MetronomeModalProps {
  onClose: () => void
}

export default function MetronomeModal({ onClose }: MetronomeModalProps) {
  const [bpm, setBpm] = useState(120)
  const [beatsPerMeasure, setBeatsPerMeasure] = useState(4)
  const [isPlaying, setIsPlaying] = useState(false)
  const [activeBeat, setActiveBeat] = useState(-1)

  // Audio Context & Scheduling Refs
  const audioCtxRef = useRef<AudioContext | null>(null)
  const nextNoteTimeRef = useRef(0)
  const currentBeatInBarRef = useRef(0)
  const timerIDRef = useRef<number | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  
  // Keep refs of state for the audio scheduling loop (which runs outside React's render cycle)
  const bpmRef = useRef(bpm)
  const beatsPerMeasureRef = useRef(beatsPerMeasure)
  const isPlayingRef = useRef(isPlaying)
  const notesInQueueRef = useRef<{ beat: number, time: number }[]>([])

  // Update refs when state changes
  useEffect(() => { bpmRef.current = bpm }, [bpm])
  useEffect(() => { beatsPerMeasureRef.current = beatsPerMeasure }, [beatsPerMeasure])
  useEffect(() => { isPlayingRef.current = isPlaying }, [isPlaying])

  const scheduleNote = (beatNumber: number, time: number) => {
    // 1. Push to visual queue
    notesInQueueRef.current.push({ beat: beatNumber, time })

    // 2. Play sound
    if (!audioCtxRef.current) return
    const osc = audioCtxRef.current.createOscillator()
    const gain = audioCtxRef.current.createGain()

    osc.connect(gain)
    gain.connect(audioCtxRef.current.destination)

    // Higher pitch for the downbeat, lower for the rest
    if (beatNumber === 0 && beatsPerMeasureRef.current > 1) {
      osc.frequency.value = 1000
    } else {
      osc.frequency.value = 800
    }

    // Envelope to make a short, percussive "click"
    gain.gain.setValueAtTime(1, time)
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05)
    
    osc.start(time)
    osc.stop(time + 0.05)
  }

  const scheduler = () => {
    if (!audioCtxRef.current) return
    // Schedule notes 100ms in advance
    while (nextNoteTimeRef.current < audioCtxRef.current.currentTime + 0.1) {
      scheduleNote(currentBeatInBarRef.current, nextNoteTimeRef.current)
      
      // Advance time and beat
      const secondsPerBeat = 60.0 / bpmRef.current
      nextNoteTimeRef.current += secondsPerBeat
      currentBeatInBarRef.current = (currentBeatInBarRef.current + 1) % beatsPerMeasureRef.current
    }
    timerIDRef.current = window.setTimeout(scheduler, 25)
  }

  const drawVisuals = () => {
    if (!audioCtxRef.current || !isPlayingRef.current) {
      setActiveBeat(-1)
      return
    }

    let currentTime = audioCtxRef.current.currentTime
    
    // Process the queue and find the active beat
    while (notesInQueueRef.current.length && notesInQueueRef.current[0].time < currentTime) {
      setActiveBeat(notesInQueueRef.current[0].beat)
      notesInQueueRef.current.shift() // Remove played note
    }

    animationFrameRef.current = requestAnimationFrame(drawVisuals)
  }

  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false)
      if (timerIDRef.current) window.clearTimeout(timerIDRef.current)
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
      notesInQueueRef.current = []
      setActiveBeat(-1)
    } else {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
      // Resume context if browser suspended it
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume()
      }
      setIsPlaying(true)
      currentBeatInBarRef.current = 0
      nextNoteTimeRef.current = audioCtxRef.current.currentTime + 0.05
      scheduler()
      drawVisuals()
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerIDRef.current) window.clearTimeout(timerIDRef.current)
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close()
      }
    }
  }, [])

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-700 shadow-2xl rounded-3xl p-8 w-full max-w-sm relative flex flex-col items-center">
        <button onClick={onClose} className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer">✕</button>
        
        <h3 className="font-bold text-xl text-white mb-8">Metronome</h3>

        {/* BPM Display */}
        <div className="flex items-center gap-6 mb-8">
          <button 
            onClick={() => setBpm(Math.max(20, bpm - 1))}
            className="w-12 h-12 flex items-center justify-center rounded-2xl bg-slate-800 hover:bg-slate-700 text-white text-2xl font-bold transition cursor-pointer"
          >
            -
          </button>
          <div className="flex flex-col items-center w-24">
            <span className="text-6xl font-black text-white tracking-tighter">{bpm}</span>
            <span className="text-xs font-bold text-slate-500 tracking-widest uppercase">BPM</span>
          </div>
          <button 
            onClick={() => setBpm(Math.min(300, bpm + 1))}
            className="w-12 h-12 flex items-center justify-center rounded-2xl bg-slate-800 hover:bg-slate-700 text-white text-2xl font-bold transition cursor-pointer"
          >
            +
          </button>
        </div>

        {/* Slider */}
        <input 
          type="range" 
          min="20" 
          max="300" 
          value={bpm} 
          onChange={(e) => setBpm(Number(e.target.value))}
          className="w-full accent-indigo-500 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer mb-8"
        />

        {/* Visual Beats Indicator */}
        <div className="flex gap-3 mb-8 h-8 items-center">
          {Array.from({ length: beatsPerMeasure }).map((_, i) => (
            <div 
              key={i}
              className={`rounded-full transition-all duration-75 ${
                activeBeat === i 
                  ? (i === 0 ? 'w-5 h-5 bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.6)]' : 'w-4 h-4 bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]')
                  : 'w-3 h-3 bg-slate-800'
              }`}
            />
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4 w-full">
          <select 
            value={beatsPerMeasure} 
            onChange={(e) => setBeatsPerMeasure(Number(e.target.value))}
            className="bg-slate-950 border border-slate-700 rounded-xl p-4 text-sm font-bold text-white outline-none focus:border-indigo-500 transition cursor-pointer"
          >
            <option value={1}>1 Beat</option>
            <option value={2}>2/4 Time</option>
            <option value={3}>3/4 Time</option>
            <option value={4}>4/4 Time</option>
            <option value={6}>6/8 Time</option>
          </select>

          <button 
            onClick={togglePlay}
            className={`flex-1 py-4 rounded-xl text-lg font-black text-white shadow-lg transition hover:scale-105 active:scale-95 cursor-pointer ${
              isPlaying ? 'bg-rose-600 hover:bg-rose-500' : 'bg-indigo-600 hover:bg-indigo-500'
            }`}
          >
            {isPlaying ? 'STOP' : 'PLAY'}
          </button>
        </div>
      </div>
    </div>
  )
}