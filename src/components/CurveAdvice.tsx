interface Props {
  tips: string[]
}

export function CurveAdvice({ tips }: Props) {
  if (!tips.length) return null
  return (
    <ul className="curve-advice">
      {tips.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  )
}
