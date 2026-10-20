import { Component } from "react";

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Erro não tratado na interface:", error, errorInfo);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
        <section className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">Erro inesperado</p>
          <h1 className="mt-2 text-2xl font-bold">Não foi possível carregar esta tela</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Seus dados continuam seguros. Recarregue a aplicação para tentar novamente.
          </p>
          <button
            type="button"
            className="mt-6 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
            onClick={() => window.location.reload()}
          >
            Recarregar aplicação
          </button>
        </section>
      </main>
    );
  }
}
