import { useCallback, useEffect, useState } from "react";
import { api, apiList, clearSession } from "../api";
import { parseMapLocation } from "../location";
import { go } from "../router";

const EMPTY_SHOP = {
  name: "",
  business_type: "garage",
  description: "",
  years_experience: "",
  city: "Parakou",
  district: "",
  address: "",
  latitude: "",
  longitude: "",
  phone: "",
  whatsapp: "",
  opening_hours: {},
  mobile_service: false,
  services: [],
  vehicle_types: [],
};

const WEEK_DAYS = [
  ["monday", "Lundi"],
  ["tuesday", "Mardi"],
  ["wednesday", "Mercredi"],
  ["thursday", "Jeudi"],
  ["friday", "Vendredi"],
  ["saturday", "Samedi"],
  ["sunday", "Dimanche"],
];

const STATUS_LABELS = {
  new: "Nouvelle",
  answered: "Répondue",
  accepted: "Acceptée",
  in_progress: "En cours",
  declined: "Refusée",
  completed: "Terminée",
  cancelled: "Annulée",
};
const VERIFICATION_STATUS_LABELS = {
  not_submitted: "Non soumis",
  pending: "En attente",
  in_review: "En cours de vérification",
  verified: "Professionnel vérifié",
  rejected: "Refusé",
};

const setWhenChanged = (setter, nextValue) =>
  setter((currentValue) =>
    JSON.stringify(currentValue) === JSON.stringify(nextValue)
      ? currentValue
      : nextValue
  );

const vehicleSlugsForScope = (scope) => {
  if (scope === "auto") return ["voiture"];
  if (scope === "moto") return ["moto"];
  if (scope === "both") return ["voiture", "moto"];
  return [];
};

export default function MechanicDashboard({
  user,
  onLogout,
  onPreviewShop,
  onUserUpdate,
}) {
  const [shops, setShops] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [services, setServices] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [verification, setVerification] = useState({
    status: "not_submitted",
    documents: [],
  });
  const [profileValues, setProfileValues] = useState({
    first_name: user.first_name || "",
    last_name: user.last_name || "",
    phone: user.phone || "",
  });
  const [profilePhotoFile, setProfilePhotoFile] = useState(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [identityDocument, setIdentityDocument] = useState(null);
  const [businessDocument, setBusinessDocument] = useState(null);
  const [trainingDocument, setTrainingDocument] = useState(null);
  const [otherDocuments, setOtherDocuments] = useState([]);
  const [verificationSaving, setVerificationSaving] = useState(false);
  const [galleryFiles, setGalleryFiles] = useState([]);
  const [shop, setShop] = useState(EMPTY_SHOP);
  const [locationInput, setLocationInput] = useState("");
  const [locationMessage, setLocationMessage] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [editingShopId, setEditingShopId] = useState(null);
  const [showShopForm, setShowShopForm] = useState(false);
  const [answers, setAnswers] = useState({});
  const [quoteFilter, setQuoteFilter] = useState("all");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(true);
  const [savingShop, setSavingShop] = useState(false);
  const [savingQuoteId, setSavingQuoteId] = useState(null);

  const loadDashboard = useCallback(async (silent = false) => {
    if (!silent) setBusy(true);
    setError("");
    try {
      const [shopList, quoteList, serviceList, vehicleList, verificationStatus] = await Promise.all([
        apiList("/shops/"),
        apiList("/quotes/"),
        apiList("/services/"),
        apiList("/vehicle-types/"),
        api("/auth/verification/"),
      ]);
      setWhenChanged(setShops, shopList.filter((item) => item.owner === user.id));
      setWhenChanged(setQuotes, quoteList);
      setWhenChanged(setServices, serviceList);
      setWhenChanged(setVehicles, vehicleList);
      setVerification(verificationStatus);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      if (!silent) setBusy(false);
    }
  }, [user.id]);

  useEffect(() => {
    loadDashboard();
    const refresh = () => {
      if (document.visibilityState === "visible") loadDashboard(true);
    };
    const intervalId = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refresh);
    };
  }, [loadDashboard]);

  useEffect(() => {
    setProfileValues({
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      phone: user.phone || "",
    });
  }, [user.first_name, user.last_name, user.phone]);

  useEffect(() => {
    if (shops.length || !vehicles.length || editingShopId) return;
    const scopeSlugs = vehicleSlugsForScope(user.vehicle_scope);
    const vehicleIds = vehicles
      .filter((vehicle) => scopeSlugs.includes(vehicle.slug))
      .map((vehicle) => vehicle.id);
    if (!vehicleIds.length) return;
    setShop((currentShop) =>
      currentShop.vehicle_types.length
        ? currentShop
        : { ...currentShop, vehicle_types: vehicleIds }
    );
  }, [editingShopId, shops.length, user.vehicle_scope, vehicles]);

  const updateShop = (event) => {
    const { name, value, checked, type } = event.target;
    setShop({ ...shop, [name]: type === "checkbox" ? checked : value });
  };

  const updateSelection = (field, id) => {
    const selected = shop[field].includes(id)
      ? shop[field].filter((value) => value !== id)
      : [...shop[field], id];
    if (field === "vehicle_types") {
      const compatibleServiceIds = new Set(
        services
          .filter(
            (service) =>
              !selected.length ||
              !service.vehicle_types?.length ||
              service.vehicle_types.some((vehicleId) => selected.includes(vehicleId))
          )
          .map((service) => service.id)
      );
      setShop({
        ...shop,
        vehicle_types: selected,
        services: shop.services.filter((serviceId) => compatibleServiceIds.has(serviceId)),
      });
      return;
    }
    setShop({ ...shop, [field]: selected });
  };

  const updateOpeningHours = (day, value) => {
    setShop((currentShop) => {
      const openingHours = { ...currentShop.opening_hours };
      if (value === "closed") {
        openingHours[day] = null;
      } else if (value === "unknown") {
        delete openingHours[day];
      } else if (value === "open") {
        openingHours[day] = {
          open: openingHours[day]?.open || "",
          close: openingHours[day]?.close || "",
        };
      } else {
        openingHours[day] = {
          ...openingHours[day],
          [value.field]: value.value,
        };
      }
      return { ...currentShop, opening_hours: openingHours };
    });
  };

  const beginCreateShop = () => {
    const scopeSlugs = vehicleSlugsForScope(user.vehicle_scope);
    setShop({
      ...EMPTY_SHOP,
      vehicle_types: vehicles
        .filter((vehicle) => scopeSlugs.includes(vehicle.slug))
        .map((vehicle) => vehicle.id),
    });
    setLocationInput("");
    setLocationMessage("");
    setPhotoFile(null);
    setGalleryFiles([]);
    setEditingShopId(null);
    setShowShopForm(true);
    setError("");
    setNotice("");
    document.getElementById("shop-form")?.scrollIntoView({ behavior: "smooth" });
  };

  const beginEditShop = (item) => {
    setLocationInput(
      item.latitude != null && item.longitude != null
        ? `${item.latitude}, ${item.longitude}`
        : ""
    );
    setLocationMessage("");
    setPhotoFile(null);
    setGalleryFiles([]);
    setShop({
      name: item.name,
      business_type: item.business_type,
      description: item.description || "",
      years_experience: item.years_experience ?? "",
      city: item.city,
      district: item.district,
      address: item.address || "",
      latitude: item.latitude ?? "",
      longitude: item.longitude ?? "",
      phone: item.phone,
      whatsapp: item.whatsapp || "",
      opening_hours: item.opening_hours || {},
      mobile_service: item.mobile_service,
      services: item.services,
      vehicle_types: item.vehicle_types,
    });
    setEditingShopId(item.id);
    setShowShopForm(true);
    setError("");
    setNotice("");
    window.setTimeout(
      () => document.getElementById("shop-form")?.scrollIntoView({ behavior: "smooth" }),
      0
    );
  };

  const closeShopForm = () => {
    setShowShopForm(false);
    setEditingShopId(null);
    setShop(EMPTY_SHOP);
    setLocationInput("");
    setLocationMessage("");
    setPhotoFile(null);
    setGalleryFiles([]);
    setError("");
  };

  const updateMapLocation = (event) => {
    const value = event.target.value;
    const coordinates = parseMapLocation(value);
    setLocationInput(value);
    setShop((currentShop) => ({
      ...currentShop,
      latitude: coordinates?.latitude ?? "",
      longitude: coordinates?.longitude ?? "",
    }));
    setLocationMessage(
      !value.trim()
        ? ""
        : coordinates
          ? `Position repérée : ${coordinates.latitude}, ${coordinates.longitude}`
          : "Coordonnées non reconnues. Collez la position copiée dans Google Maps ou un lien complet contenant les coordonnées."
    );
    setError("");
  };

  const saveShop = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (photoFile && photoFile.size > 5 * 1024 * 1024) {
      setError("La photo ne peut pas dépasser 5 Mo.");
      return;
    }
    const invalidHours = WEEK_DAYS.some(([day]) => {
      const hours = shop.opening_hours[day];
      return (
        hours &&
        (!hours.open ||
          !hours.close ||
          hours.open >= hours.close)
      );
    });
    if (invalidHours) {
      setError("Vérifiez les heures d’ouverture et de fermeture de chaque jour.");
      return;
    }
    if (locationInput.trim() && (shop.latitude === "" || shop.longitude === "")) {
      setError(
        "La localisation collée n’a pas été reconnue. Copiez les coordonnées Google Maps (ex. 9.337, 2.630) ou un lien complet contenant la position."
      );
      return;
    }
    setSavingShop(true);
    try {
      const savedShop = await api(editingShopId ? `/shops/${editingShopId}/` : "/shops/", {
        method: editingShopId ? "PATCH" : "POST",
        body: JSON.stringify({
          ...shop,
          latitude: shop.latitude === "" ? null : Number(shop.latitude),
          longitude: shop.longitude === "" ? null : Number(shop.longitude),
        }),
      });
      let photoError = "";
      if (photoFile) {
        const formData = new FormData();
        formData.append("photo", photoFile);
        try {
          await api(`/shops/${savedShop.id}/`, {
            method: "PATCH",
            body: formData,
          });
        } catch (uploadError) {
          photoError = ` Les autres informations ont été enregistrées, mais la photo n’a pas pu être envoyée : ${uploadError.message}`;
        }
      }
      let galleryError = "";
      if (galleryFiles.length) {
        const formData = new FormData();
        galleryFiles.forEach((file) => formData.append("photos", file));
        try {
          await api(`/shops/${savedShop.id}/photos/`, {
            method: "POST",
            body: formData,
          });
        } catch (uploadError) {
          galleryError = ` La galerie n’a pas pu être envoyée : ${uploadError.message}`;
        }
      }
      setShop(EMPTY_SHOP);
      setShowShopForm(false);
      setEditingShopId(null);
      setPhotoFile(null);
      setGalleryFiles([]);
      setNotice(
        (editingShopId
          ? "Les informations de votre atelier ont été mises à jour."
          : "Votre atelier est enregistré. Vous pouvez maintenant gérer sa fiche depuis Mes ateliers.") +
          photoError +
          galleryError
      );
      await loadDashboard();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSavingShop(false);
    }
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setProfileSaving(true);
    try {
      const formData = new FormData();
      Object.entries(profileValues).forEach(([key, value]) => formData.append(key, value));
      if (profilePhotoFile) formData.append("profile_photo", profilePhotoFile);
      const updatedUser = await api("/auth/me/", {
        method: "PATCH",
        body: formData,
      });
      onUserUpdate(updatedUser);
      setProfilePhotoFile(null);
      setNotice("Votre profil professionnel a été mis à jour.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setProfileSaving(false);
    }
  };

  const submitVerification = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!identityDocument || !businessDocument) {
      setError("Ajoutez une pièce d’identité et un justificatif d’activité.");
      return;
    }
    setVerificationSaving(true);
    try {
      const formData = new FormData();
      formData.append("identity_document", identityDocument);
      formData.append("business_document", businessDocument);
      if (trainingDocument) formData.append("training_document", trainingDocument);
      otherDocuments.forEach((file) => formData.append("other_documents", file));
      const submitted = await api("/auth/verification/", {
        method: "POST",
        body: formData,
      });
      setVerification(submitted);
      setIdentityDocument(null);
      setBusinessDocument(null);
      setTrainingDocument(null);
      setOtherDocuments([]);
      event.currentTarget.reset();
      setNotice("Votre demande et vos justificatifs ont été transmis pour vérification.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setVerificationSaving(false);
    }
  };

  const replyToQuote = async (quoteId) => {
    setError("");
    setNotice("");
    setSavingQuoteId(quoteId);
    try {
      await api(`/quotes/${quoteId}/respond/`, {
        method: "POST",
        body: JSON.stringify({ response: answers[quoteId] || "" }),
      });
      setAnswers({ ...answers, [quoteId]: "" });
      setNotice("Votre réponse a été envoyée au client.");
      await loadDashboard();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSavingQuoteId(null);
    }
  };

  const completeQuote = async (quoteId) => {
    setError("");
    setNotice("");
    setSavingQuoteId(quoteId);
    try {
      await api(`/quotes/${quoteId}/complete/`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      setNotice("La réparation est marquée comme terminée.");
      await loadDashboard();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSavingQuoteId(null);
    }
  };

  const startQuote = async (quoteId) => {
    setError("");
    setNotice("");
    setSavingQuoteId(quoteId);
    try {
      await api(`/quotes/${quoteId}/start/`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      setNotice("La réparation est maintenant marquée comme en cours.");
      await loadDashboard();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSavingQuoteId(null);
    }
  };

  const visibleQuotes =
    quoteFilter === "all"
      ? quotes
      : quotes.filter((quote) => quote.status === quoteFilter);
  const newQuoteCount = quotes.filter((quote) => quote.status === "new").length;
  const acceptedQuoteCount = quotes.filter((quote) => ["accepted", "in_progress"].includes(quote.status)).length;
  const completedQuoteCount = quotes.filter((quote) => quote.status === "completed").length;

  const logout = () => {
    clearSession();
    onLogout();
    go("accueil");
  };

  return (
    <main className="dashboard">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">ESPACE GARAGE & RÉPARATEUR</p>
          <h1>Bonjour{user.first_name ? ` ${user.first_name}` : ""}</h1>
          <p className="mu">Votre tableau de bord pour piloter vos ateliers et suivre vos clients.</p>
        </div>
        <div className="row">
          <button className="btn" type="button" onClick={loadDashboard}>Actualiser</button>
          <button className="btn" type="button" onClick={logout}>Se déconnecter</button>
        </div>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      {notice && <p className="form-success" role="status">{notice}</p>}

      <section className="dashboard-stats" aria-label="Résumé de l’activité">
        <article className="card stat-card">
          <span className="stat-icon">🔧</span>
          <span className="stat-value">{shops.length}</span>
          <span className="mu">Atelier{shops.length !== 1 ? "s" : ""}</span>
        </article>
        <article className="card stat-card">
          <span className="stat-icon">📩</span>
          <span className="stat-value">{newQuoteCount}</span>
          <span className="mu">Nouvelle{newQuoteCount !== 1 ? "s" : ""} demande{newQuoteCount !== 1 ? "s" : ""}</span>
        </article>
        <article className="card stat-card">
          <span className="stat-icon">🛠️</span>
          <span className="stat-value">{acceptedQuoteCount}</span>
          <span className="mu">Réparation{acceptedQuoteCount !== 1 ? "s" : ""} en cours</span>
        </article>
        <article className="card stat-card">
          <span className="stat-icon">✅</span>
          <span className="stat-value">{completedQuoteCount}</span>
          <span className="mu">Intervention{completedQuoteCount !== 1 ? "s" : ""} terminée{completedQuoteCount !== 1 ? "s" : ""}</span>
        </article>
      </section>

      <section className="dashboard-section">
        <div className="sec"><h2>Mon profil professionnel</h2></div>
        <form className="card profile-form" onSubmit={saveProfile}>
          <div className="profile-photo-row">
            {user.profile_photo && (
              <img className="profile-photo-preview" src={user.profile_photo} alt="Photo de profil actuelle" />
            )}
            <div>
              <label htmlFor="profile-photo">Photo de profil</label>
              <input
                id="profile-photo"
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                onChange={(event) => setProfilePhotoFile(event.target.files?.[0] || null)}
              />
              <p className="mu sm">JPG, PNG ou WebP, 5 Mo maximum.</p>
            </div>
          </div>
          <div className="form-grid">
            <div>
              <label htmlFor="profile-first-name">Prénom</label>
              <input
                id="profile-first-name"
                value={profileValues.first_name}
                onChange={(event) => setProfileValues({ ...profileValues, first_name: event.target.value })}
              />
            </div>
            <div>
              <label htmlFor="profile-last-name">Nom</label>
              <input
                id="profile-last-name"
                value={profileValues.last_name}
                onChange={(event) => setProfileValues({ ...profileValues, last_name: event.target.value })}
              />
            </div>
            <div>
              <label htmlFor="profile-phone">Téléphone professionnel</label>
              <input
                id="profile-phone"
                type="tel"
                value={profileValues.phone}
                onChange={(event) => setProfileValues({ ...profileValues, phone: event.target.value })}
              />
            </div>
          </div>
          <button className="btn p" type="submit" disabled={profileSaving}>
            {profileSaving ? "Enregistrement…" : "Enregistrer mon profil"}
          </button>
        </form>
      </section>

      <section className="dashboard-section">
        <div className="sec">
          <h2>Vérification professionnelle</h2>
          <span className={`shop-badge verification-${verification.status}`}>
            {VERIFICATION_STATUS_LABELS[verification.status] || verification.status}
          </span>
        </div>
        {verification.rejection_reason && (
          <p className="form-error" role="status">
            Motif du refus : {verification.rejection_reason}
          </p>
        )}
        {verification.documents?.length > 0 && (
          <p className="mu sm">
            Documents soumis : {verification.documents.map((document) => document.original_filename).join(" · ")}
          </p>
        )}
        {["not_submitted", "rejected"].includes(verification.status) ? (
          <form className="card verification-form" onSubmit={submitVerification}>
            <p className="mu">
              Envoyez une pièce d’identité et un justificatif d’activité. Le diplôme ou l’attestation de formation est facultatif.
              Vos documents ne sont visibles que par les administrateurs autorisés.
            </p>
            <label htmlFor="identity-document">Pièce d’identité (PDF ou image)</label>
            <input id="identity-document" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" required onChange={(event) => setIdentityDocument(event.target.files?.[0] || null)} />
            <label htmlFor="business-document">Justificatif d’activité / atelier</label>
            <input id="business-document" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" required onChange={(event) => setBusinessDocument(event.target.files?.[0] || null)} />
            <label htmlFor="training-document">Formation ou diplôme (facultatif)</label>
            <input id="training-document" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(event) => setTrainingDocument(event.target.files?.[0] || null)} />
            <label htmlFor="other-documents">Autres justificatifs (facultatif, 5 fichiers maximum)</label>
            <input id="other-documents" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" multiple onChange={(event) => setOtherDocuments(Array.from(event.target.files || []))} />
            <button className="btn p" type="submit" disabled={verificationSaving}>
              {verificationSaving ? "Envoi sécurisé…" : "Soumettre ma demande"}
            </button>
          </form>
        ) : (
          <p className="card mu">
            {verification.status === "verified"
              ? "Votre profil a été vérifié par un administrateur. Le badge est affiché sur vos ateliers."
              : "Votre demande est enregistrée. Elle sera examinée par un administrateur."}
          </p>
        )}
      </section>

      <section className="dashboard-section">
        <div className="sec">
          <h2>Mes ateliers</h2>
          {!busy && shops.length > 0 && (
            <button className="btn p" type="button" onClick={beginCreateShop}>+ Ajouter un atelier</button>
          )}
        </div>
        {busy ? <p className="mu">Chargement de votre espace…</p> : shops.length === 0 ? (
          <p className="card mu">Vous n’avez pas encore enregistré d’atelier. Ajoutez-en un ci-dessous pour apparaître dans l’annuaire.</p>
        ) : (
          <div className="cg">
            {shops.map((item) => (
              <article className="card mechanic-shop" key={item.id}>
                <div className="row">
                  <h3>{item.name}</h3>
                  <span className={item.is_verified ? "shop-badge verified" : "shop-badge"}>
                    {item.is_verified ? "Professionnel vérifié" : "Non vérifié"}
                  </span>
                </div>
                <p className="mu">{item.district}, {item.city} · {item.phone}</p>
                <p>{item.description || "Aucune description renseignée."}</p>
                <p className="mu">{item.vehicle_types.map((id) => vehicles.find((vehicle) => vehicle.id === id)?.name).filter(Boolean).join(" · ") || "Aucun véhicule renseigné"}</p>
                <div className="shop-card-actions">
                  <button className="btn" type="button" onClick={() => beginEditShop(item)}>Modifier les informations</button>
                  <button
                    className="btn"
                    type="button"
                    onClick={() =>
                      onPreviewShop(
                        item.id,
                        item.vehicle_types
                          .map((id) => vehicles.find((vehicle) => vehicle.id === id)?.slug)
                          .filter(Boolean)
                      )
                    }
                  >
                    Voir la fiche publique
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="dashboard-section">
        <div className="sec">
          <h2>Demandes de devis</h2>
          <div className="quote-filters" role="tablist" aria-label="Filtrer les demandes">
            {[
              ["all", "Toutes"],
              ["new", "Nouvelles"],
              ["answered", "Répondues"],
              ["accepted", "Acceptées"],
              ["in_progress", "En cours"],
              ["completed", "Terminées"],
            ].map(([filter, label]) => (
              <button
                key={filter}
                className={`chip${quoteFilter === filter ? " on" : ""}`}
                type="button"
                role="tab"
                aria-selected={quoteFilter === filter}
                onClick={() => setQuoteFilter(filter)}
              >
                {label}
                {filter === "new" && newQuoteCount > 0 ? ` (${newQuoteCount})` : ""}
              </button>
            ))}
          </div>
        </div>
        {busy ? <p className="mu">Chargement des demandes…</p> : quotes.length === 0 ? (
          <p className="card mu">Aucune demande pour le moment. Les demandes de vos clients apparaîtront ici.</p>
        ) : visibleQuotes.length === 0 ? (
          <p className="card mu">Aucune demande dans cette catégorie.</p>
        ) : (
          <div className="dashboard-list">
            {visibleQuotes.map((quote) => (
              <article className="card quote-card" key={quote.id}>
                <div className="row">
                  <h3>{quote.shop_name}</h3>
                  <span className={`shop-badge status-${quote.status}`}>{STATUS_LABELS[quote.status] || quote.status}</span>
                </div>
                <p className="mu">Client : {quote.customer_name} · {quote.urgency === "immediate" ? "🚨 Urgent" : "Planifiée"} · {new Date(quote.created_at).toLocaleDateString("fr-FR")}</p>
                <p><b>{quote.vehicle_model}</b> · {quote.problem}</p>
                {quote.mechanic_response && <p className="form-success">Votre réponse : {quote.mechanic_response}</p>}
                {quote.status === "new" && (
                  <div className="quote-reply">
                    <label htmlFor={`answer-${quote.id}`}>Votre réponse au client</label>
                    <textarea id={`answer-${quote.id}`} rows="3" maxLength="3000" value={answers[quote.id] || ""} onChange={(event) => setAnswers({ ...answers, [quote.id]: event.target.value })} placeholder="Décrivez votre diagnostic ou proposez un rendez-vous." />
                    <button className="btn p" type="button" disabled={savingQuoteId === quote.id || !answers[quote.id]?.trim()} onClick={() => replyToQuote(quote.id)}>{savingQuoteId === quote.id ? "Envoi…" : "Envoyer ma réponse"}</button>
                  </div>
                )}
                {quote.status === "accepted" && (
                  <div className="row quote-status-actions">
                    <button className="btn p" type="button" disabled={savingQuoteId === quote.id} onClick={() => startQuote(quote.id)}>
                      Commencer la réparation
                    </button>
                    <button className="btn" type="button" disabled={savingQuoteId === quote.id} onClick={() => completeQuote(quote.id)}>
                      Marquer comme terminée
                    </button>
                  </div>
                )}
                {quote.status === "in_progress" && (
                  <button className="btn p" type="button" disabled={savingQuoteId === quote.id} onClick={() => completeQuote(quote.id)}>
                    {savingQuoteId === quote.id ? "Mise à jour…" : "Signaler le travail terminé"}
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      {(showShopForm || shops.length === 0) && (
      <section className="dashboard-section" id="shop-form">
        <div className="sec">
          <h2>{editingShopId ? "Modifier mon atelier" : "Ajouter un atelier"}</h2>
          {shops.length > 0 && <button className="btn" type="button" onClick={closeShopForm}>Annuler</button>}
        </div>
        <form className="card shop-form" onSubmit={saveShop}>
          <label htmlFor="shop-name">Nom de l’atelier</label>
          <input id="shop-name" name="name" required maxLength="160" value={shop.name} onChange={updateShop} />
          <label htmlFor="shop-type">Type d’activité</label>
          <select id="shop-type" name="business_type" value={shop.business_type} onChange={updateShop}>
            <option value="garage">Garage</option>
            <option value="mechanic">Mécanicien</option>
          </select>
          <div className="form-grid">
            <div>
              <label htmlFor="shop-city">Ville</label>
              <input id="shop-city" name="city" required value={shop.city} onChange={updateShop} />
            </div>
            <div>
              <label htmlFor="shop-district">Quartier</label>
              <input id="shop-district" name="district" required value={shop.district} onChange={updateShop} />
            </div>
            <div>
              <label htmlFor="shop-phone">Téléphone</label>
              <input id="shop-phone" name="phone" type="tel" required value={shop.phone} onChange={updateShop} />
            </div>
            <div>
              <label htmlFor="shop-whatsapp">WhatsApp (facultatif)</label>
              <input id="shop-whatsapp" name="whatsapp" type="tel" value={shop.whatsapp} onChange={updateShop} />
            </div>
          </div>
          <label htmlFor="shop-address">Adresse (facultative)</label>
          <input id="shop-address" name="address" value={shop.address} onChange={updateShop} />
          <label htmlFor="shop-photo">Photo principale de l’atelier (facultative)</label>
          <input
            id="shop-photo"
            name="photo"
            type="file"
            accept="image/*"
            onChange={(event) => setPhotoFile(event.target.files?.[0] || null)}
            aria-describedby="shop-photo-help"
          />
          <p id="shop-photo-help" className="mu sm">
            Image JPG, PNG ou WebP, 5 Mo maximum.
          </p>
          {photoFile && (
            <p className="sm form-success" role="status">
              Photo sélectionnée : {photoFile.name}
            </p>
          )}
          {!photoFile && editingShopId && shops.find((item) => item.id === editingShopId)?.photo && (
            <img
              className="shop-photo-preview"
              src={shops.find((item) => item.id === editingShopId).photo}
              alt="Photo actuelle de l’atelier"
            />
          )}
          {editingShopId && shops.find((item) => item.id === editingShopId)?.gallery?.length > 0 && (
            <div className="shop-gallery">
              {shops.find((item) => item.id === editingShopId).gallery.map((photo) => (
                <img key={photo} src={photo} alt="Photo actuelle de l’atelier" />
              ))}
            </div>
          )}
          <label htmlFor="shop-gallery">Ajouter des photos à la galerie (10 maximum au total)</label>
          <input
            id="shop-gallery"
            type="file"
            accept=".jpg,.jpeg,.png,.webp"
            multiple
            onChange={(event) => setGalleryFiles(Array.from(event.target.files || []))}
          />
          {galleryFiles.length > 0 && (
            <p className="mu sm">{galleryFiles.length} photo(s) prête(s) à envoyer.</p>
          )}
          <fieldset>
            <legend>Position sur la carte (facultative)</legend>
            <p className="mu sm">
              Dans Google Maps, faites un clic droit sur votre emplacement, cliquez sur les coordonnées pour les copier, puis collez-les ici.
            </p>
            <label htmlFor="shop-location">Coordonnées ou lien Google Maps</label>
            <input
              id="shop-location"
              name="map_location"
              type="text"
              autoComplete="off"
              placeholder="Ex. 9.337, 2.630 ou collez le lien Google Maps"
              value={locationInput}
              onChange={updateMapLocation}
              aria-describedby="shop-location-help shop-location-status"
            />
            <p id="shop-location-help" className="mu sm">
              Les coordonnées GPS ou un lien complet Google Maps avec la position sont acceptés.
            </p>
            {locationMessage && (
              <p
                id="shop-location-status"
                className={`sm ${shop.latitude === "" ? "form-error" : "form-success"}`}
                role="status"
              >
                {locationMessage}
              </p>
            )}
          </fieldset>
          <fieldset>
            <legend>Horaires d’ouverture (facultatifs)</legend>
            <div className="opening-hours-editor">
              {WEEK_DAYS.map(([day, label]) => {
                const hours = shop.opening_hours[day];
                const status = !Object.hasOwn(shop.opening_hours, day)
                  ? "unknown"
                  : hours === null
                    ? "closed"
                    : "open";
                return (
                  <div className="opening-hours-row" key={day}>
                    <label htmlFor={`hours-${day}-status`}>{label}</label>
                    <select
                      id={`hours-${day}-status`}
                      value={status}
                      onChange={(event) => updateOpeningHours(day, event.target.value)}
                    >
                      <option value="unknown">Non renseigné</option>
                      <option value="open">Ouvert</option>
                      <option value="closed">Fermé</option>
                    </select>
                    {status === "open" ? (
                      <div className="opening-time-fields">
                        <label className="sr-only" htmlFor={`hours-${day}-open`}>Ouverture {label}</label>
                        <input
                          id={`hours-${day}-open`}
                          type="time"
                          value={hours?.open || ""}
                          onChange={(event) => updateOpeningHours(day, { field: "open", value: event.target.value })}
                          aria-label={`Heure d’ouverture ${label}`}
                        />
                        <span className="mu">à</span>
                        <label className="sr-only" htmlFor={`hours-${day}-close`}>Fermeture {label}</label>
                        <input
                          id={`hours-${day}-close`}
                          type="time"
                          value={hours?.close || ""}
                          onChange={(event) => updateOpeningHours(day, { field: "close", value: event.target.value })}
                          aria-label={`Heure de fermeture ${label}`}
                        />
                      </div>
                    ) : <span aria-hidden="true" />}
                  </div>
                );
              })}
            </div>
          </fieldset>
          <label htmlFor="shop-description">Description (facultative)</label>
          <textarea id="shop-description" name="description" rows="3" maxLength="3000" value={shop.description} onChange={updateShop} />
          <label htmlFor="shop-experience">Années d’expérience (facultatif)</label>
          <input id="shop-experience" name="years_experience" type="number" min="0" max="80" value={shop.years_experience} onChange={updateShop} />
          <fieldset>
            <legend>Véhicules pris en charge</legend>
            <div className="choice-list">
              {vehicles.map((item) => (
                <label key={item.id}>
                  <input type="checkbox" checked={shop.vehicle_types.includes(item.id)} onChange={() => updateSelection("vehicle_types", item.id)} />
                  {item.name}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Services proposés</legend>
            <div className="choice-list">
              {services
                .filter(
                  (item) =>
                    !shop.vehicle_types.length ||
                    !item.vehicle_types?.length ||
                    item.vehicle_types.some((id) => shop.vehicle_types.includes(id))
                )
                .map((item) => (
                <label key={item.id}>
                  <input type="checkbox" checked={shop.services.includes(item.id)} onChange={() => updateSelection("services", item.id)} />
                  {item.name}
                </label>
                ))}
            </div>
          </fieldset>
          <label className="check-label">
            <input name="mobile_service" type="checkbox" checked={shop.mobile_service} onChange={updateShop} />
            Je propose le dépannage à domicile
          </label>
          <div className="row shop-form-actions">
            <button className="btn p" type="submit" disabled={savingShop || busy}>
              {savingShop ? "Enregistrement…" : editingShopId ? "Enregistrer les modifications" : "Créer mon atelier"}
            </button>
            {shops.length > 0 && <button className="btn" type="button" onClick={closeShopForm}>Annuler</button>}
          </div>
        </form>
      </section>
      )}
    </main>
  );
}
