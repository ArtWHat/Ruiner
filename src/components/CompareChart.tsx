import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface Props {
  actual: number[]
  expected: number[]
  rankSeries?: number[] | null
  rankLabel?: string
  actualLabel: string
  expectedLabel: string
  color: string
}

export function CompareChart({
  actual,
  expected,
  rankSeries,
  rankLabel,
  actualLabel,
  expectedLabel,
  color,
}: Props) {
  const len = Math.max(actual.length, expected.length, rankSeries?.length ?? 0)
  const data = Array.from({ length: len }, (_, i) => ({
    m: i,
    actual: actual[i] ?? actual[actual.length - 1] ?? 0,
    expected: expected[i] ?? expected[expected.length - 1] ?? 0,
    rank: rankSeries
      ? (rankSeries[i] ?? rankSeries[rankSeries.length - 1] ?? 0)
      : undefined,
  }))

  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: 12, bottom: 4 }}>
          <CartesianGrid stroke="#2a3142" strokeDasharray="3 3" />
          <XAxis
            dataKey="m"
            stroke="#8b93a7"
            tickFormatter={(v) => `${v}`}
            label={{
              value: 'мин',
              position: 'insideBottomRight',
              offset: -2,
              fill: '#8b93a7',
            }}
          />
          <YAxis
            stroke="#8b93a7"
            width={72}
            tickMargin={6}
            tickFormatter={(v) =>
              v >= 1000 ? `${Math.round(v / 100) / 10}k` : `${v}`
            }
          />
          <Tooltip
            contentStyle={{
              background: '#12151c',
              border: '1px solid #2a3142',
              borderRadius: 8,
            }}
            labelFormatter={(m) => `Минута ${m}`}
            formatter={(value: number) => value.toLocaleString('ru-RU')}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="actual"
            name={actualLabel}
            stroke={color}
            dot={false}
            strokeWidth={2.2}
          />
          <Line
            type="monotone"
            dataKey="expected"
            name={expectedLabel}
            stroke="#7d8699"
            strokeDasharray="5 5"
            dot={false}
            strokeWidth={1.8}
          />
          {rankSeries && (
            <Line
              type="monotone"
              dataKey="rank"
              name={rankLabel ?? 'Среднее ранга'}
              stroke="#c084fc"
              dot={false}
              strokeWidth={2}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
