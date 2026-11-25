import { useEffect, useState } from "react";
import { apiList, clearSession, readSession, saveSession } from "./api";
import { useRoute, go } from "./router";
import { Head } from "./components/Common";
import Account from "./pages/Account";
import Home from "./pages/Home";
import Results from "./pages/Results";
import Detail from "./pages/Detail";
import Quote from "./pages/Quote";
import MechanicDashboard from "./pages/MechanicDashboard";
import CustomerDashboard from "./pages/CustomerDashboard";

export default function App() {
  const route = useRoute();
  const [q, setQ] = useState({ type: "Moto", service: "", lieu: "" });
  const [selectedUniverse, setSelectedUniverse] = useState(
    () => window.localStorage.getItem("mecanoconnect.universe") || ""
  );
  const universe =
    route === "auto" ? "auto" : route === "moto" ? "moto" : selectedUniverse;
  const [sel, setSel] = useState(null);
  const [session, setSession] = useState(readSession);
  const [shops, setShops] = useState([]);
  const [services, setServices] = useState([]);
  const [directoryLoading, setDirectoryLoading] = useState(true);
  const [directoryError, setDirectoryError] = useState("");

  useEffect(() => {
    if (route !== "auto" && route !== "moto") return;
    setSelectedUniverse(route);
    window.localStorage.setItem("mecanoconnect.universe", route);
    setQ((current) =>
      current.type === (route === "auto" ? "Voiture" : "Moto")
        ? current
        : { ...current, type: route === "auto" ? "Voiture" : "Moto", service: "" }
    );
  }, [route]);

  useEffect(() => {
    let active = true;
    if (!["auto", "moto", "resultats", "fiche", "devis"].includes(route)) {
      return undefined;
    }
    const activeUniverse = universe || "auto";
    const activeVehicleSlug = activeUniverse === "auto" ? "voiture" : "moto";
    setDirectoryLoading(true);
    Promise.all([
      apiList(`/shops/?vehicle=${activeVehicleSlug}`),
      apiList(`/services/?vehicle=${activeVehicleSlug}`),
      apiList("/vehicle-types/"),
    ])
      .then(([shopList, serviceList, vehicleList]) => {
        const serviceNames = new Map(serviceList.map((item) => [item.id, item.name]));
        const serviceSlugs = new Map(serviceList.map((item) => [item.id, item.slug]));
        const vehicleNames = new Map(vehicleList.map((item) => [item.id, item.name]));
        const mappedShops = shopList.map((shop) => ({
          id: shop.id,
          apiId: shop.id,
          n: shop.name,
          ownerName: shop.owner_name,
          ownerProfilePhoto: shop.owner_profile_photo,
          t: shop.business_type === "garage" ? "Garage" : "Mécanicien",
          q: shop.district,
          city: shop.city,
          d: null,
          s: shop.average_rating,
          a: shop.review_count,
          v: shop.vehicle_types.map((id) => vehicleNames.get(id)).filter(Boolean),
          vehicleTypes: shop.vehicle_types.map((id) => ({
            id,
            name: vehicleNames.get(id),
          })).filter((item) => item.name),
          sp: shop.services.map((id) => serviceNames.get(id)).filter(Boolean),
          serviceSlugs: shop.services.map((id) => serviceSlugs.get(id)).filter(Boolean),
          serviceIds: shop.services,
          o: null,
          dom: shop.mobile_service,
          latitude: shop.latitude,
          longitude: shop.longitude,
          h: "Horaires à confirmer",
          desc: shop.description || "Aucune description renseignée.",
          yearsExperience: shop.years_experience,
          phone: shop.phone,
          whatsapp: shop.whatsapp,
          address: shop.address,
          photo: shop.photo,
          gallery: shop.gallery || [],
          openingHours: shop.opening_hours,
          isVerified: shop.is_verified,
        }));
        if (active) {
          setShops(mappedShops);
          setServices(serviceList);
          setDirectoryError("");
          setSel((current) =>
            mappedShops.some((shop) => shop.id === current)
              ? current
              : mappedShops[0]?.id ?? null
          );
        }
      })
      .catch((error) => {
        if (active) setDirectoryError(error.message);
      })
      .finally(() => {
        if (active) setDirectoryLoading(false);
      });
    return () => {
      active = false;
    };
  }, [route, universe]);

  useEffect(() => {
    const handleStorage = () => setSession(readSession());
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    if (route === "mecanicien" && !session?.access) go("connexion");
    else if (route === "mecanicien" && session.user?.role !== "mechanic") go("accueil");
    else if (route === "client" && !session?.access) go("connexion");
    else if (route === "client" && session.user?.role !== "customer") go("accueil");
    else if (route === "devis" && !session?.access) {
      window.sessionStorage.setItem("mecanoconnect.returnTo", "devis");
      go("connexion");
    } else if (route === "devis" && session.user?.role !== "customer") {
      go("mecanicien");
    }
    else if (
      ["connexion", "inscription", "inscription-client"].includes(route) &&
      session?.access
    ) {
      go(session.user?.role === "mechanic" ? "mecanicien" : "client");
    }
  }, [route, session]);

  const handleLogout = () => {
    clearSession();
    setSession(null);
  };

  const handleUserUpdate = (user) => {
    const updatedSession = { ...session, user };
    saveSession(updatedSession);
    setSession(updatedSession);
  };

  const selectUniverse = (nextUniverse) => {
    const nextType = nextUniverse === "auto" ? "Voiture" : "Moto";
    setSelectedUniverse(nextUniverse);
    window.localStorage.setItem("mecanoconnect.universe", nextUniverse);
    setQ((current) => ({ ...current, type: nextType, service: "" }));
    setSel(null);
    go(nextUniverse);
  };

  const pick = (id, stay) => {
    setSel(id);
    if (!stay) go("fiche");
    else if (route === "accueil") go("resultats");
  };
  const r = shops.find((shop) => shop.id === sel) || shops[0];

  return (
    <div className="w" data-universe={universe || undefined}>
      <Head
        user={session?.user}
        onLogout={handleLogout}
        universe={route === "accueil" ? null : universe}
      />
      {route === "resultats" ? (
        <Results q={q} setQ={setQ} sel={sel} pick={pick} shops={shops} loading={directoryLoading} error={directoryError} services={services} universe={universe || "auto"} />
      ) : route === "fiche" ? (
        r ? <Detail r={r} session={session} /> : <p className="card mu">Cet atelier n’est plus disponible.</p>
      ) : route === "devis" ? (
        r ? <Quote r={r} q={q} user={session?.user} /> : <p className="card mu">Cet atelier n’est plus disponible.</p>
      ) : route === "connexion" || route === "inscription" ? (
        <Account mode={route} onLogin={setSession} />
      ) : route === "inscription-client" ? (
        <Account mode={route} onLogin={setSession} />
      ) : route === "mecanicien" && session?.user?.role === "mechanic" ? (
        <MechanicDashboard
          user={session.user}
          onLogout={handleLogout}
          onUserUpdate={handleUserUpdate}
          onPreviewShop={(id, vehicleSlugs) => {
            const currentVehicleSlug =
              universe === "auto" ? "voiture" : universe === "moto" ? "moto" : null;
            const supportsCurrentUniverse =
              currentVehicleSlug && vehicleSlugs.includes(currentVehicleSlug);
            const nextUniverse =
              supportsCurrentUniverse
                ? universe
                : vehicleSlugs.includes("voiture") || !vehicleSlugs.length
                  ? "auto"
                  : "moto";
            setSelectedUniverse(nextUniverse);
            window.localStorage.setItem("mecanoconnect.universe", nextUniverse);
            setQ((current) => ({
              ...current,
              type: nextUniverse === "auto" ? "Voiture" : "Moto",
              service: "",
            }));
            setSel(id);
            go("fiche");
          }}
        />
      ) : route === "client" && session?.user?.role === "customer" ? (
        <CustomerDashboard user={session.user} onLogout={handleLogout} />
      ) : (
        <Home
          q={q}
          setQ={setQ}
          pick={pick}
          shops={shops}
          loading={directoryLoading}
          error={directoryError}
          services={services}
          universe={route === "accueil" ? null : universe || "auto"}
          onSelectUniverse={selectUniverse}
        />
      )}
      <footer>MécanoConnect · Fait au Bénin.</footer>
    </div>
  );
}
