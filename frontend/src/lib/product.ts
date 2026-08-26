export interface SaleProduct {
  id: string
  gym_id: string
  name: string
  category: string
  price: number | null
  stock_quantity: number
  photo_url: string | null
  active: boolean
  created_at: string
}

export const PRODUCT_CATEGORY_SUGGESTIONS = [
  'Suplementos',
  'Proteína',
  'Ropa',
  'Accesorios',
  'Bebidas',
  'Snacks',
  'Equipo de entrenamiento',
  'Higiene',
  'Otro',
]