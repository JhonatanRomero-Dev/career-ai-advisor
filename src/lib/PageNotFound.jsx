import { Link } from "react-router-dom";
import { Home, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { readAuthSession } from "@/lib/authSession";

export default function PageNotFound() {
  const destination = readAuthSession().isAuthenticated ? "/dashboard" : "/";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <SearchX className="h-8 w-8 text-primary" />
        </div>
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">404</p>
        <h1 className="mt-2 text-2xl font-bold text-foreground">Página não encontrada</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          O endereço acessado não existe ou foi movido.
        </p>
        <Link to={destination}>
          <Button className="mt-6">
            <Home className="h-4 w-4" />
            Voltar
          </Button>
        </Link>
      </div>
    </div>
  );
}
