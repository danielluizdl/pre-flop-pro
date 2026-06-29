export const pt = {
  common: {
    back: 'Voltar',
    close: 'Fechar',
    wait: 'Aguarde...',
    retry: 'Tentar novamente',
    loading: 'Carregando…',
  },
  auth: {
    tagline: 'Treine seus ranges pré-flop',
    forgotTitle: 'Esqueci minha senha',
    forgotBody: 'Peça ao coach do seu time para resetar sua senha. Você receberá uma senha temporária e vai definir uma nova no próximo login.',
    fullName: 'Nome Completo:',
    emailLabel: 'E-mail:',
    usernameLabel: 'Usuário:',
    passwordLabel: 'Senha:',
    teamCodeLabel: 'Código do time:',
    login: 'Entrar',
    createAccount: 'Criar conta',
    forgotPassword: 'Esqueci minha senha',
    haveAccount: 'Já tenho conta — entrar',
    errors: {
      usernameMin: 'Usuário deve ter ao menos 6 caracteres',
      passwordMin: 'Senha deve ter ao menos 8 caracteres',
      invalidEmail: 'Informe um e-mail válido',
      unexpected: 'Erro inesperado',
    },
  },
} as const

export type Messages = typeof pt
