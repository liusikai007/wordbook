import type { ReactNode } from 'react'
import { playPronunciation } from '../services/speech'
import type { WordEntry } from '../types'
import { cn } from '../utils/cn'
import { IconSpeaker } from './icons'

const POS_LABEL: Record<string, string> = {
  noun: 'n.',
  verb: 'v.',
  adjective: 'adj.',
  adverb: 'adv.',
  pronoun: 'pron.',
  preposition: 'prep.',
  conjunction: 'conj.',
  interjection: 'interj.',
  determiner: 'det.',
  numeral: 'num.',
  exclamation: 'excl.',
  article: 'art.',
  auxiliary: 'aux.',
  other: '其他'
}

function posLabel(pos: string): string {
  return POS_LABEL[pos.toLowerCase()] ?? pos
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="section-title mb-2">{title}</h3>
      {children}
    </section>
  )
}

function ChipList({ items, onPick }: { items: string[]; onPick?: (word: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) =>
        onPick ? (
          <button key={item} type="button" onClick={() => onPick(item)} className="chip">
            {item}
          </button>
        ) : (
          <span key={item} className="chip">
            {item}
          </span>
        )
      )}
    </div>
  )
}

function PhoneticChip({
  label,
  phonetic,
  onClick
}: {
  label: string
  phonetic: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={'播放' + label + '发音'}
      className="chip min-h-[44px] gap-1.5 px-3"
    >
      <IconSpeaker className="h-4 w-4 text-sage-600 dark:text-sage-300" />
      <span className="text-ink-500 dark:text-cream-300">{label}</span>
      <span className="phonetic">{phonetic}</span>
    </button>
  )
}

interface Props {
  entry: WordEntry
  /** 去掉外层卡片样式，用于嵌在列表项里 */
  bare?: boolean
  /** 点击近义词 / 反义词时回填到查词框 */
  onPickWord?: (word: string) => void
}

export default function WordCard({ entry, bare, onPickWord }: Props) {
  const uk = entry.ukPhonetic
  const us = entry.usPhonetic
  const samePhonetic = Boolean(uk && us && uk === us)
  const hasDetail = entry.senses.length > 0 || Boolean(entry.translation)

  return (
    <article className={cn(bare ? 'animate-fade-up' : 'card animate-fade-up')}>
      <header>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <h2 className="text-[26px] font-semibold leading-tight tracking-tight text-ink-900 dark:text-cream-50">
            {entry.word}
          </h2>
          {entry.source === 'cache' ? (
            <span className="rounded-full bg-cream-200/80 px-2 py-0.5 text-[10px] text-ink-300 dark:bg-night-700 dark:text-cream-300">
              本地缓存
            </span>
          ) : null}
          {entry.provider === 'datamuse' ? (
            <span className="rounded-full bg-apricot-100 px-2 py-0.5 text-[10px] text-ink-500 dark:bg-night-700 dark:text-apricot-200">
              备用词源 · 暂无例句
            </span>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {uk ? (
            <PhoneticChip
              label={samePhonetic ? '音标' : '英'}
              phonetic={uk}
              onClick={() => playPronunciation(entry.word, 'uk', entry.audioUk)}
            />
          ) : null}
          {us && !samePhonetic ? (
            <PhoneticChip
              label="美"
              phonetic={us}
              onClick={() => playPronunciation(entry.word, 'us', entry.audioUs)}
            />
          ) : null}
          {!uk && !us ? (
            <button
              type="button"
              onClick={() => playPronunciation(entry.word, 'us', entry.audioUs)}
              className="chip min-h-[44px] gap-1.5 px-3"
            >
              <IconSpeaker className="h-4 w-4 text-sage-600 dark:text-sage-300" />
              听发音
            </button>
          ) : null}
        </div>

        {entry.translation ? (
          <p className="mt-3 text-[17px] font-medium text-sage-700 dark:text-sage-200">
            {entry.translation}
          </p>
        ) : null}
      </header>

      {entry.senses.length ? (
        <Section title="释义">
          <div className="space-y-4">
            {entry.senses.map((sense) => (
              <div key={sense.partOfSpeech}>
                <span className="inline-block rounded-lg bg-sage-100 px-2 py-0.5 text-[12px] font-semibold text-sage-700 dark:bg-night-700 dark:text-sage-200">
                  {posLabel(sense.partOfSpeech)}
                </span>
                {sense.translation ? (
                  <p className="mt-1.5 text-[16px] text-ink-900 dark:text-cream-50">
                    {sense.translation}
                  </p>
                ) : null}
                <ol className="mt-1 space-y-1.5">
                  {sense.definitions.map((definition, index) => (
                    <li
                      key={definition.text}
                      className="text-[14px] leading-relaxed text-ink-500 dark:text-cream-300"
                    >
                      <span className="mr-1 text-ink-300">{index + 1}.</span>
                      {definition.text}
                      {definition.example ? (
                        <span className="mt-0.5 block italic text-ink-300 dark:text-cream-300/70">
                          {definition.example}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {entry.examples.length ? (
        <Section title="例句">
          <div className="space-y-2">
            {entry.examples.map((example) => (
              <div key={example.en} className="card-flat">
                <p className="text-[15px] leading-relaxed text-ink-700 dark:text-cream-100">
                  {example.en}
                </p>
                {example.zh ? (
                  <p className="mt-1 text-[13px] text-ink-500 dark:text-cream-300">{example.zh}</p>
                ) : null}
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {entry.phrases.length ? (
        <Section title="常见搭配">
          <ChipList items={entry.phrases} />
        </Section>
      ) : null}

      {entry.synonyms.length ? (
        <Section title="近义词">
          <ChipList items={entry.synonyms} onPick={onPickWord} />
        </Section>
      ) : null}

      {entry.antonyms.length ? (
        <Section title="反义词">
          <ChipList items={entry.antonyms} onPick={onPickWord} />
        </Section>
      ) : null}

      {!hasDetail ? (
        <p className="mt-5 rounded-2xl bg-cream-100 p-3 text-[13px] text-ink-500 dark:bg-night-700/60 dark:text-cream-300">
          词典接口这次没有返回释义，稍后再查一次试试。
        </p>
      ) : null}
    </article>
  )
}
