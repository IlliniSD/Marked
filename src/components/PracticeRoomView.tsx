interface PracticeRoomViewProps {
  onOpenMetronome: () => void
  onOpenTuner: () => void
}

export default function PracticeRoomView({ onOpenMetronome, onOpenTuner }: PracticeRoomViewProps) {
  return (
    <div className="max-w-6xl mx-auto w-full p-8 lg:p-12 animate-in fade-in duration-300">
      <h2 className="text-4xl font-black text-white mb-2 tracking-tight">Practice Room</h2>
      <p className="text-slate-400 mb-10 text-lg">Your personal toolkit for individual practice.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <button onClick={onOpenMetronome} className="bg-slate-900 border border-slate-800 p-10 rounded-[2rem] text-left hover:border-indigo-500 transition-all group cursor-pointer shadow-xl relative overflow-hidden">
          <div className="text-6xl mb-6 group-hover:scale-110 group-hover:-rotate-6 transition-transform origin-bottom-left inline-block relative z-10">⏱</div>
          <h3 className="text-2xl font-bold text-white mb-3 relative z-10">Metronome</h3>
          <p className="text-slate-400 text-sm leading-relaxed relative z-10">A high-precision visual and audio metronome. Tap to set tempo, customize time signatures, and keep perfect rhythm.</p>
        </button>

        <button onClick={onOpenTuner} className="bg-slate-900 border border-slate-800 p-10 rounded-[2rem] text-left hover:border-emerald-500 transition-all group cursor-pointer shadow-xl relative overflow-hidden">
          <div className="text-6xl mb-6 group-hover:scale-110 group-hover:rotate-6 transition-transform origin-bottom-left inline-block relative z-10">🪕</div>
          <h3 className="text-2xl font-bold text-white mb-3 relative z-10">Chromatic Tuner</h3>
          <p className="text-slate-400 text-sm leading-relaxed relative z-10">Real-time microphone analysis with a digital needle. Ensure your instrument is perfectly in tune before rehearsal.</p>
        </button>
      </div>
    </div>
  )
}
