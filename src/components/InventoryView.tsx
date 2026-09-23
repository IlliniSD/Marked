import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import type { InventoryItem } from '../types'

interface InventoryViewProps {
  ensembleId: string
  isDirector: boolean
  currentUserId: string
  roster: { user_id: string; name: string; role: string }[]
}

export default function InventoryView({ ensembleId, isDirector, currentUserId, roster }: InventoryViewProps) {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)

  // Form state for adding items (Director only)
  const [name, setName] = useState('')
  const [itemType, setItemType] = useState('Folder')
  const [conditionNotes, setConditionNotes] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  useEffect(() => {
    fetchInventory()
  }, [ensembleId])

  const fetchInventory = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('ensemble_id', ensembleId)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setItems(data)
    }
    setLoading(false)
  }

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    const { data, error } = await supabase
      .from('inventory_items')
      .insert({
        ensemble_id: ensembleId,
        name: name.trim(),
        item_type: itemType,
        condition_notes: conditionNotes.trim()
      })
      .select()
      .single()

    if (error) {
      alert(error.message)
    } else if (data) {
      setItems([data, ...items])
      setName('')
      setConditionNotes('')
      setIsAdding(false)
    }
  }

  const handleAssignItem = async (itemId: string, userId: string) => {
    const assignedValue = userId === '' ? null : userId
    const { error } = await supabase
      .from('inventory_items')
      .update({ assigned_to: assignedValue })
      .eq('id', itemId)

    if (!error) {
      setItems(items.map(item => item.id === itemId ? { ...item, assigned_to: assignedValue } : item))
    } else {
      alert(error.message)
    }
  }

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this inventory item?')) return
    const { error } = await supabase.from('inventory_items').delete().eq('id', itemId)
    if (!error) {
      setItems(items.filter(item => item.id !== itemId))
    }
  }

  // Filter items if viewed by a regular student (show only what's assigned to them)
  const displayedItems = isDirector ? items : items.filter(item => item.assigned_to === currentUserId)

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header & Controls */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Ensemble Inventory</h1>
          <p className="text-sm text-slate-400 mt-1">
            {isDirector ? 'Manage folders, instruments, and school equipment.' : 'Equipment and folders assigned to you.'}
          </p>
        </div>
        {isDirector && (
          <button 
            onClick={() => setIsAdding(!isAdding)} 
            className="bg-indigo-600 hover:bg-indigo-500 shadow-lg text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition cursor-pointer"
          >
            {isAdding ? 'Cancel' : '+ Add Item'}
          </button>
        )}
      </div>

      {/* Add Item Form (Director Only) */}
      {isDirector && isAdding && (
        <form onSubmit={handleAddItem} className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-lg font-bold text-white">Add New Inventory Item</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1 block">Item Name / Number</label>
              <input 
                type="text" 
                placeholder="e.g. Folder #14 or School Cello #3" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                required 
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:border-indigo-500" 
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1 block">Type</label>
              <select 
                value={itemType} 
                onChange={e => setItemType(e.target.value)} 
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="Folder">Music Folder</option>
                <option value="Instrument">Instrument</option>
                <option value="Accessory">Accessory / Mute</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1 block">Condition Notes (Optional)</label>
            <input 
              type="text" 
              placeholder="e.g. Minor scratch on scroll, all leaves present in folder" 
              value={conditionNotes} 
              onChange={e => setConditionNotes(e.target.value)} 
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:border-indigo-500" 
            />
          </div>
          <button type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold shadow-lg transition cursor-pointer">
            Save Item
          </button>
        </form>
      )}

      {/* Inventory List */}
      {loading ? (
        <p className="text-slate-500 text-sm">Loading inventory...</p>
      ) : displayedItems.length === 0 ? (
        <div className="py-12 flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-2xl bg-slate-950/30">
          <span className="text-4xl mb-4">📦</span>
          <p className="text-slate-400 text-sm font-medium">
            {isDirector ? 'No inventory items added yet.' : 'You have no school equipment or folders assigned to you.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedItems.map(item => {
            const assignedStudent = roster.find(r => r.user_id === item.assigned_to)

            return (
              <div key={item.id} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      {item.item_type}
                    </span>
                    {isDirector && (
                      <button onClick={() => handleDeleteItem(item.id)} className="text-xs text-rose-400 hover:text-rose-300 cursor-pointer">
                        Delete
                      </button>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-white">{item.name}</h3>
                  {item.condition_notes && (
                    <p className="text-xs text-slate-400 mt-1 italic">Notes: {item.condition_notes}</p>
                  )}
                </div>

                {/* Assignment Controls */}
                <div className="pt-3 border-t border-slate-800">
                  {isDirector ? (
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Assigned Student</label>
                      <select 
                        value={item.assigned_to || ''} 
                        onChange={e => handleAssignItem(item.id, e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 text-xs rounded-xl px-3 py-2 text-slate-200 outline-none focus:border-indigo-500 cursor-pointer"
                      >
                        <option value="">Unassigned</option>
                        {roster.map(r => (
                          <option key={r.user_id} value={r.user_id}>{r.name}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">Status:</span>
                      <span className="text-emerald-400 font-semibold bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">Checked out to you</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}