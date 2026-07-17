export const MOTIVATIONAL_QUOTES = [
  'Cada refeição é uma nova oportunidade de cuidar de você.',
  'Pequenas escolhas consistentes criam grandes transformações.',
  'Seu corpo é seu projeto mais importante.',
  'Progredir é melhor do que ser perfeito.',
  'A jornada de mil quilômetros começa com um único passo.',
  'Você é o que você come — e você merece o melhor.',
  'Consistência supera intensidade todos os dias.',
  'Cuide do seu corpo, ele é o único lugar onde você vive.',
  'Cada dia saudável é uma vitória que vale celebrar.',
  'O melhor investimento é na sua saúde.',
  'Alimentar-se bem é um ato de amor próprio.',
  'Não existe motivação sem ação — comece agora.',
  'Seu futuro eu vai agradecer as escolhas de hoje.',
  'Saúde não é destino, é um estilo de vida.',
  'Beber água é o gesto mais simples de autocuidado.',
  'Cada dia bem dormido é um dia melhor aproveitado.',
  'Movimento é vida — mova-se mais, sinta mais.',
  'Você não precisa ser perfeito, precisa ser consistente.',
  'Uma refeição fora do plano não apaga dias de dedicação.',
  'Seu corpo ouve tudo que sua mente diz — seja gentil.',
  'Energia boa começa no prato.',
  'Hidratação é o segredo que todo mundo esquece.',
  'Respeite seu ritmo, celebre seu progresso.',
  'Comer bem não é punição, é privilégio.',
  'A melhor versão de você está sendo construída agora.',
  'Nutrição é informação para as suas células.',
  'Cada escolha saudável é um voto para quem você quer ser.',
  'Descanso também faz parte do progresso.',
  'Você tem força suficiente para começar de novo hoje.',
  'Saúde é o maior patrimônio que você pode acumular.',
] as const

/** Day-of-year based rotation — same phrase all day for everyone, changes daily. */
export function motivationalQuoteOfTheDay(date: Date = new Date()): string {
  const start = new Date(date.getFullYear(), 0, 0)
  const diff = date.getTime() - start.getTime()
  const dayOfYear = Math.floor(diff / 86400000)
  const quote = MOTIVATIONAL_QUOTES[dayOfYear % MOTIVATIONAL_QUOTES.length]
  return quote ?? MOTIVATIONAL_QUOTES[0]
}
