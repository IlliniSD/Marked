import localforage from 'localforage'

/**
 * Checks if we have downloaded this exact sheet music before.
 * If yes, loads it from the device's hard drive instantly (Offline Mode).
 * If no, downloads it from Supabase and caches it for next time.
 */
export async function getOfflinePdf(partId: string, fileUrl: string): Promise<string> {
  try {
    // 1. Check offline cache
    const cachedBlob = await localforage.getItem<Blob>(`pdf_${partId}`)
    if (cachedBlob) {
      console.log('Loaded from offline cache!')
      return URL.createObjectURL(cachedBlob)
    }
    
    // 2. Not cached? Fetch from the network
    console.log('Downloading and caching for offline use...')
    const response = await fetch(fileUrl)
    if (!response.ok) throw new Error('Network fetch failed')
    const blob = await response.blob()
    
    // 3. Save to device storage
    await localforage.setItem(`pdf_${partId}`, blob)
    
    // Return the local device URL
    return URL.createObjectURL(blob)
  } catch (error) {
    console.error("Failed to load or cache PDF:", error)
    return fileUrl // Fallback to raw internet URL if something goes wrong
  }
}