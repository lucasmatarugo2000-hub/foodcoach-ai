export const CHART_COLORS = {
  primary: 'rgb(var(--color-primary))',
  secondary: 'rgb(var(--color-secondary))',
  accent: 'rgb(var(--color-accent))',
  series1: 'var(--chart-1)',
  series2: 'var(--chart-2)',
  series3: 'var(--chart-3)',
  series4: 'var(--chart-4)',
  neutral: 'var(--chart-neutral)',
  grid: 'var(--chart-grid)',
}

export const chartTooltipStyle = {
  contentStyle: {
    backgroundColor: 'rgb(var(--color-card))',
    border: '1px solid rgb(var(--color-border))',
    borderRadius: 12,
    fontSize: 12,
  },
  labelStyle: { color: 'rgb(var(--color-foreground))' },
  itemStyle: { color: 'rgb(var(--color-foreground))' },
}

/** Always-dark tooltip (independent of app theme) for charts that want a punchier look. */
export const darkChartTooltipStyle = {
  contentStyle: {
    backgroundColor: '#161b22',
    border: '1px solid #30363d',
    borderRadius: 12,
    fontSize: 12,
  },
  labelStyle: { color: '#e6edf3' },
  itemStyle: { color: '#e6edf3' },
}
