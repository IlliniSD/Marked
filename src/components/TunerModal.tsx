import { useState, useEffect, useRef } from 'react'

interface TunerModalProps {
  onClose: () => void
}

const NOTE_STRINGS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

function noteFromPitch(frequency: number): number {
  const noteNum = 12 * (Math.log(frequency / 440) / Math.log(2))
  return Math.round(noteNum) + 69
}

function centsOffFromPitch(frequency: number, note: number): number {
  return Math.floor(1200 * Math.log(frequency / frequencyFromNoteNumber(note)) / Math.log(2))
}

function frequencyFromNoteNumber(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12)
}

// Simple autocorrelation algorithm to detect pitch from mic stream
function autoCorrelate(buffer: Float32Array, sampleRate: number): number {
  const SIZE = buffer.length
  let sumOfSquares = 0
  for (let i = 0; i < SIZE; i++) {
    const val = buffer[i]
    sumOfSquares += val * val
  }
  const rootMeanSquare = Math.sqrt(sumOfSquares / SIZE)
  if (rootMeanSquare < 0.01) return -1 // Too quiet

  let r1 = 0
  let r2 = SIZE - 1
  const threshold = 0.2
  
  for (let i = 0; i < SIZE / 2; i++) {
    if (Math.abs(buffer[i]) < threshold) {
      r1 = i
      break
    }
  }
  for (let i = 1; i < SIZE / 2; i++) {
    if (Math.abs(buffer[SIZE - i]) < threshold) {
      r2 = SIZE - i
      break
    }
  }

  const slice = buffer.slice(r1, r2)
  const c = new Array(slice.length).fill(0)
  for (let i = 0; i < slice.length; i++) {
    for (let j = 0; j < slice.length - i; j++) {
      c[i] = c[i] + slice[j] * slice[j + i]
    }
  }

  let d = 0
  while (c[d] > c[d + 1]) d++
  let maxval = -1
  let maxpos = -1
  for (let i = d; i < slice.length; i++) {
    if (c[i] > maxval) {
      maxval = c[i]
      maxpos = i
    }
  }
  let T0 = maxpos
  const x1 = c[T0 - 1]
  const x2 = c[T0]
  const x3 = c[T0 + 1]
  const a = (x1 + x3 - 2 * x2) / 2
  const b = (x3 - x1) / 2
  if (a) T0 = T0 - b / (2 * a)

  return sampleRate / T0
}

export default function TunerModal({ onClose }: TunerModalProps) {
  const [pitch, setPitch] = useState<number | null>(null)
  const [noteName, setNoteName] = useState<string>('--')
  const [cents, setCents] = useState<number>(0)
  const [activeOctave, setActiveOctave] = useState<number | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafIdRef = useRef<number | null>(null)

  useEffect(() => {
    let isMounted = true

    const initAudio = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        if (!isMounted) {
          stream.getTracks().forEach(track => track.stop())
          return
        }
        streamRef.current = stream

        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
        audioContextRef.current = audioCtx
        const analyser = audioCtx.createAnalyser()
        analyser.fftSize = 2048
        analyserRef.current = analyser

        const source = audioCtx.createMediaStreamSource(stream)
        source.connect(analyser)

        const buffer = new Float32Array(analyser.fftSize)

        const updatePitch = () => {
          if (!analyserRef.current || !audioContextRef.current) return
          analyserRef.current.getFloatTimeDomainData(buffer)
          const freq = autoCorrelate(buffer, audioContextRef.current.sampleRate)

          if (freq !== -1) {
            setPitch(Math.round(freq * 10) / 10)
            const noteNum = noteFromPitch(freq)
            const name = NOTE_STRINGS[noteNum % 12]
            const octave = Math.floor(noteNum / 12) - 1
            const c = centsOffFromPitch(freq, noteNum)

            setNoteName(name)
            setActiveOctave(octave)
            setCents(c)
          } else {
            setPitch(null)
          }

          rafIdRef.current = requestAnimationFrame(updatePitch)
        }

        updatePitch()
      } catch (err: any) {
        if (isMounted) {
          setErrorMsg("Microphone access denied or unavailable. Please check your browser permissions.")
        }
      }
    }

    initAudio()

    return () => {
      isMounted = false
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current)
      if (streamRef.current) streamRef.current.getTracks().forEach((t: MediaStreamTrack) => t.stop())
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close()
      }
    }
  }, [])

  // Map cents (-50 to +50) to visual needle position percentage (0% to 100%)
  const needlePos = Math.max(0, Math.min(100, ((cents + 50) / 100) * 100))
  const isAligned = Math.abs(cents) <= 3 && pitch !== null

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-700 shadow-2xl rounded-3xl p-8 w-full max-w-sm relative flex flex-col items-center">
        <button onClick={onClose} className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer">✕</button>
        
        <h3 className="font-bold text-xl text-white mb-2">Live Tuner</h3>
        <p className="text-xs text-slate-400 mb-8">Play a sustained note into your microphone</p>

        {errorMsg ? (
          <p className="text-rose-400 text-sm text-center py-6 leading-relaxed">{errorMsg}</p>
        ) : (
          <div className="w-full flex flex-col items-center space-y-8">
            {/* Note Display */}
            <div className={`relative w-36 h-36 rounded-full flex flex-col items-center justify-center border-2 transition-colors duration-300 ${isAligned ? 'bg-emerald-500/10 border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.2)]' : 'bg-slate-950 border-slate-800'}`}>
              <span className={`text-5xl font-black tracking-tight transition-colors ${isAligned ? 'text-emerald-400' : 'text-white'}`}>
                {noteName}
                {activeOctave !== null && <span className="text-2xl font-bold opacity-60">{activeOctave}</span>}
              </span>
              <span className="text-xs font-semibold text-slate-400 mt-1">
                {pitch ? `${pitch} Hz` : 'Listening...'}
              </span>
            </div>

            {/* Tuning Meter Bar */}
            <div className="w-full space-y-2">
              <div className="relative h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                {/* Center Target Marker */}
                <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5 bg-indigo-500 z-10"></div>
                {/* Moving Needle */}
                <div 
                  className={`absolute top-0 bottom-0 w-2 -ml-1 rounded-full transition-all duration-75 ${isAligned ? 'bg-emerald-400' : 'bg-indigo-400'}`}
                  style={{ left: `${needlePos}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1">
                <span>♭ Flat</span>
                <span className={isAligned ? 'text-emerald-400' : 'text-slate-400'}>{cents > 0 ? `+${cents}c` : `${cents}c`}</span>
                <span>Sharp ♯</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}