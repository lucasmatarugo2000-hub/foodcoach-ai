export interface TacoFood {
  name: string
  portion: number
  unit: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
}

export const TACO_REFERENCE = {
  description: 'Tabela Brasileira de Composição de Alimentos - UNICAMP 4ª edição',
  foods: [
    // Cereais e derivados
    { name: 'Arroz branco cozido', portion: 100, unit: 'g', calories: 128, protein: 2.3, carbs: 28.1, fat: 0.2, fiber: 1.6 },
    { name: 'Arroz integral cozido', portion: 100, unit: 'g', calories: 124, protein: 2.6, carbs: 25.8, fat: 1.0, fiber: 2.7 },
    { name: 'Aveia em flocos', portion: 100, unit: 'g', calories: 394, protein: 13.9, carbs: 66.6, fat: 8.5, fiber: 9.1 },
    { name: 'Pão francês', portion: 100, unit: 'g', calories: 300, protein: 9.4, carbs: 58.6, fat: 3.1, fiber: 2.3 },
    { name: 'Pão de forma integral', portion: 100, unit: 'g', calories: 253, protein: 8.9, carbs: 46.5, fat: 3.3, fiber: 6.9 },
    { name: 'Macarrão cozido', portion: 100, unit: 'g', calories: 136, protein: 4.7, carbs: 28.2, fat: 0.5, fiber: 1.8 },
    // Leguminosas
    { name: 'Feijão carioca cozido', portion: 100, unit: 'g', calories: 76, protein: 4.8, carbs: 13.6, fat: 0.5, fiber: 8.5 },
    { name: 'Feijão preto cozido', portion: 100, unit: 'g', calories: 77, protein: 4.5, carbs: 14.0, fat: 0.5, fiber: 8.4 },
    { name: 'Lentilha cozida', portion: 100, unit: 'g', calories: 93, protein: 6.3, carbs: 16.3, fat: 0.5, fiber: 7.9 },
    { name: 'Grão-de-bico cozido', portion: 100, unit: 'g', calories: 129, protein: 7.1, carbs: 21.7, fat: 2.1, fiber: 5.9 },
    // Carnes e ovos
    { name: 'Frango peito grelhado s/ pele', portion: 100, unit: 'g', calories: 159, protein: 32.8, carbs: 0.0, fat: 2.7, fiber: 0 },
    { name: 'Carne bovina patinho cozido', portion: 100, unit: 'g', calories: 219, protein: 32.4, carbs: 0.0, fat: 9.4, fiber: 0 },
    { name: 'Ovo inteiro cozido', portion: 100, unit: 'g', calories: 146, protein: 13.3, carbs: 0.6, fat: 9.5, fiber: 0 },
    { name: 'Atum em lata', portion: 100, unit: 'g', calories: 119, protein: 26.6, carbs: 0.0, fat: 1.3, fiber: 0 },
    { name: 'Tilápia filé grelhado', portion: 100, unit: 'g', calories: 96, protein: 20.1, carbs: 0.0, fat: 1.5, fiber: 0 },
    // Laticínios
    { name: 'Leite integral', portion: 100, unit: 'ml', calories: 61, protein: 3.2, carbs: 4.7, fat: 3.3, fiber: 0 },
    { name: 'Iogurte natural integral', portion: 100, unit: 'g', calories: 66, protein: 3.6, carbs: 4.9, fat: 3.3, fiber: 0 },
    { name: 'Queijo minas frescal', portion: 100, unit: 'g', calories: 264, protein: 17.4, carbs: 3.2, fat: 20.2, fiber: 0 },
    // Frutas
    { name: 'Banana nanica', portion: 100, unit: 'g', calories: 92, protein: 1.3, carbs: 23.8, fat: 0.1, fiber: 1.9 },
    { name: 'Mamão papaia', portion: 100, unit: 'g', calories: 40, protein: 0.5, carbs: 10.4, fat: 0.1, fiber: 1.8 },
    { name: 'Maçã fuji', portion: 100, unit: 'g', calories: 56, protein: 0.3, carbs: 15.1, fat: 0.1, fiber: 2.0 },
    { name: 'Laranja pera', portion: 100, unit: 'g', calories: 46, protein: 1.0, carbs: 11.5, fat: 0.1, fiber: 1.5 },
    { name: 'Abacate', portion: 100, unit: 'g', calories: 96, protein: 1.2, carbs: 6.0, fat: 8.4, fiber: 6.3 },
    // Tubérculos
    { name: 'Batata doce cozida', portion: 100, unit: 'g', calories: 77, protein: 0.6, carbs: 18.4, fat: 0.1, fiber: 2.2 },
    { name: 'Mandioca cozida', portion: 100, unit: 'g', calories: 125, protein: 0.6, carbs: 30.1, fat: 0.3, fiber: 1.9 },
    // Gorduras
    { name: 'Azeite de oliva', portion: 100, unit: 'ml', calories: 884, protein: 0.0, carbs: 0.0, fat: 100.0, fiber: 0 },
    { name: 'Amendoim torrado', portion: 100, unit: 'g', calories: 567, protein: 26.0, carbs: 20.0, fat: 43.9, fiber: 8.0 },
  ] satisfies TacoFood[],
}

export function findTacoFood(name: string): TacoFood | undefined {
  return TACO_REFERENCE.foods.find((f) => f.name.toLowerCase().includes(name.toLowerCase()))
}
