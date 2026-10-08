/** 拼 className 的小工具，跳过 false / null / undefined */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}
