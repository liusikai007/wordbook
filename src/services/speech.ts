/**
 * 发音模块：优先播放词典里的真人录音，失败或没有录音时退回浏览器自带的语音合成。
 * 两条路都不花钱，也不需要任何 key。
 */
export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

function pickVoice(accent: 'uk' | 'us'): SpeechSynthesisVoice | undefined {
  if (!isSpeechSupported()) return undefined
  const want = accent === 'uk' ? 'en-GB' : 'en-US'
  const voices = window.speechSynthesis.getVoices()
  return (
    voices.find((v) => v.lang.replace('_', '-') === want) ??
    voices.find((v) => v.lang.replace('_', '-').startsWith('en'))
  )
}

function speakWithTts(text: string, accent: 'uk' | 'us'): void {
  if (!isSpeechSupported()) return
  const synth = window.speechSynthesis
  synth.cancel()
  const utter = new SpeechSynthesisUtterance(text)
  utter.lang = accent === 'uk' ? 'en-GB' : 'en-US'
  utter.rate = 0.9
  utter.pitch = 1
  const voice = pickVoice(accent)
  if (voice) utter.voice = voice
  synth.speak(utter)
}

/** 播放发音；audioUrl 为空或播放失败时自动退回 TTS */
export function playPronunciation(
  text: string,
  accent: 'uk' | 'us' = 'uk',
  audioUrl?: string
): void {
  if (audioUrl) {
    try {
      const audio = new Audio(audioUrl)
      audio.play().catch(() => speakWithTts(text, accent))
      return
    } catch {
      // 落到下面的 TTS
    }
  }
  speakWithTts(text, accent)
}

export function stopPronunciation(): void {
  if (isSpeechSupported()) window.speechSynthesis.cancel()
}
