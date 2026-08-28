export type Stats = {
  range: string
  revenue: number
  orders: number
  totalSold: number
  cancelled: number
  sections: Record<'boys' | 'girls', { revenue: number; orders: number }>
  topItems: { name: string; emoji: string; sold: number; revenue: number }[]
  lowStock: { id: number; name: string; emoji: string; stock: number }[]
  devices?: {
    boys: { sender: number; receiver: number; total: number }
    girls: { sender: number; receiver: number; total: number }
    total: number
  }
}
