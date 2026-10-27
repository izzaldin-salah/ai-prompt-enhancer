export type Mode = 'Manual' | 'Auto' | 'Smart'
export type Domain = 'Coding' | 'Planning' | 'General'
export type Detail = 'Quick' | 'Standard' | 'Detailed'

export interface PromptSection {
  n?: string
  title?: string
  body?: string
  list?: string[]
}

export interface Clarification {
  question: string
  options: string[]
  chosenOption?: string
  customAnswer?: string
}

export interface SessionData {
  id?: string
  title?: string
  mode: Mode
  domain: Domain
  detail: Detail
  thought: string
  clarification?: Clarification | null
  sections: PromptSection[]
  tokenCount?: number
  updatedAt?: string
}
