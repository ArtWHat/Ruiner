import { rankIconUrl, rankMedal, rankName } from '../data/ranks'

export function RankIcon({
  rankTier,
  size = 22,
}: {
  rankTier?: number
  size?: number
}) {
  const medal = rankMedal(rankTier)
  return (
    <img
      className="rank-icon"
      src={rankIconUrl(medal || 0)}
      alt={rankName(rankTier)}
      title={rankName(rankTier)}
      width={size}
      height={size}
      style={{ width: size, height: size }}
    />
  )
}
