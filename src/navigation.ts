export type Screen = 'home' | 'quotes' | 'planning'

const key = 'controle-active-screen'

export const getSavedScreen = (): Screen => {
  const screen = sessionStorage.getItem(key)
  return screen === 'quotes' || screen === 'planning' ? screen : 'home'
}

export const saveScreen = (screen: Screen) => {
  sessionStorage.setItem(key, screen)
}
