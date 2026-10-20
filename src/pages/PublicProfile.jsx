import React from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { ProfileDisplay } from "@/components/profile/ProfessionalProfile";

export default function PublicProfile() {
  const { publicId } = useParams();
  const query = useQuery({ queryKey: ["public-profile", publicId], queryFn: () => base44.product.request(`/profiles/${encodeURIComponent(publicId)}`), retry: false });
  return <main className="mx-auto min-h-screen max-w-4xl space-y-6 px-5 py-8"><Link to="/" className="text-sm font-semibold text-primary">Career AI</Link>{query.isLoading ? <p role="status">Carregando perfil...</p> : query.isError ? <div role="alert"><h1 className="text-xl font-semibold">Perfil indisponível</h1><p className="mt-2 text-muted-foreground">O perfil está privado ou não existe.</p></div> : <ProfileDisplay profile={query.data.profile} />}</main>;
}
