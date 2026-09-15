"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  Plus,
  X,
  Heart,
  Check,
  SlidersHorizontal,
  Sparkles,
  CalendarDays,
  Shirt,
  Bookmark,
  UserRound,
  LayoutGrid,
  ImagePlus,
  Search,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Upload,
  Menu,
  CheckCircle2,
  ShoppingBag,
  Download,
} from "lucide-react";
import {
  catalog,
  buildLooks as buildFreshLooks,
  lookKey,
  defaultProfile,
  palettes,
  money,
  total,
  type Profile,
  type Piece,
  type Look,
} from "@/lib/stylist";

import { closetLimit, canAddPieces, type ClosetPlan } from "@/lib/closet-limits";
import { readOfflineState, writeOfflineState } from "@/lib/offline-store";
import { Walkthrough } from "@/components/walkthrough";
import { HeightInput } from "@/components/height-input";
import { ColorSelect } from "@/components/color-select";
import { savedLookLimit, saveToLookbook } from "@/lib/lookbook";
import { budgetStops, budgetIndex, normalizeBudget } from "@/lib/budget";
import { PieceEditor } from "@/components/piece-editor";
import { ClosetImport } from "@/components/closet-import";
import { TasteDeck } from "@/components/taste-deck";
import { AutomaticSeason } from "@/components/automatic-season";

type View =
  | "discover"
  | "style"
  | "lookbook"
  | "closet"
  | "planner"
  | "inspiration"
  | "profile";
type Inspiration = { id: string; image: string; note: string };
type State = {
  seenLooks: string[];
  plan: ClosetPlan;
  profile: Profile;
  configured: boolean;
  saved: Look[];
  closet: Piece[];
  plans: Record<string, Look>;
  inspiration: Inspiration[];
};
const INITIAL: State = {
  seenLooks: [],
  plan: "free",
  profile: defaultProfile,
  configured: false,
  saved: [],
  closet: [],
  plans: {},
  inspiration: [],
};
const STORE = "atelier.astra.v1";
const views = [
  { id: "discover", label: "Discover", icon: LayoutGrid },
  { id: "style", label: "Your stylist", icon: Sparkles },
  { id: "lookbook", label: "Lookbook", icon: Bookmark },
  { id: "closet", label: "Your closet", icon: Shirt },
  { id: "planner", label: "Outfit planner", icon: CalendarDays },
  { id: "inspiration", label: "Inspiration", icon: ImagePlus },
] as const;
const occasions = ["Everyday", "Work", "Weekend", "Dinner", "Travel"];
const vibes = [
  "Everyday ease",
  "Polished & classic",
  "Soft & romantic",
  "A little edge",
];
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function dateAt(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function dateLabel(date: string) {
  return new Date(date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
function Toggle({
  selected,
  children,
  onClick,
}: {
  selected: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className={"chip " + (selected ? "selected" : "")}
      aria-pressed={selected}
      onClick={onClick}
    >
      {children}
      {selected && <Check size={13} />}
    </button>
  );
}
function ProductImage({ piece }: { piece: Piece }) {
  return (
    <img
      src={piece.image || "/images/cherry.svg"}
      alt={piece.name}
      loading="lazy"
      onError={(e) => {
        e.currentTarget.src = "/images/cherry.svg";
        e.currentTarget.classList.add("failed-image");
      }}
    />
  );
}
function Board({ look }: { look: Look }) {
  return (
    <div className={"outfit-board " + (look.pieces.some(p=>p.role === "dress") ? "board-dress" : "board-separates")}>
      {look.pieces.slice(0, 5).map((p, i) => (
        <div key={p.id} className={"board-piece bp-" + i + " board-role-" + p.role}>
          <ProductImage piece={p} />
          {p.owned && (
            <span className="owned-dot" title="Already in your closet" />
          )}
        </div>
      ))}
      <span className="board-signature">ATELIER</span>
    </div>
  );
}
function Modal({
  title,
  children,
  onClose,
  wide = false,
  open = true,
  notice,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
  open?: boolean;
  notice?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if(open)el?.showModal();else el?.close();
    return () => el?.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      className={"modal " + (wide ? "wide" : "")}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-top">
        <span className="eyebrow">ATELIER / {title}</span>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {notice && (
        <p className="dialog-notice" role="status">
          {notice}
        </p>
      )}
      {children}
    </dialog>
  );
}
async function readPhoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/"))
    throw new Error("Choose an image file, such as a JPG or PNG.");
  if (file.size > 15 * 1024 * 1024)
    throw new Error("Choose an image smaller than 15 MB.");
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = document.createElement("canvas");
    const scale = Math.min(1, 900 / Math.max(img.width, img.height));
    c.width = img.width * scale;
    c.height = img.height * scale;
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("This browser cannot process images.");
    ctx.fillStyle = "#faf8f4";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.75);
  } catch {
    throw new Error("We could not read that image. Try a JPG or PNG.");
  } finally {
    URL.revokeObjectURL(url);
  }
}
function LookCard({
  look,
  saved,
  onOpen,
  onSave,
}: {
  look: Look;
  saved: boolean;
  onOpen: (look: Look) => void;
  onSave: (look: Look) => void;
}) {
  return (
    <article className="look-card">
      <div className="look-image">
        <button
          className="board-open"
          onClick={() => onOpen(look)}
          aria-label={"View " + look.title}
        >
          <Board look={look} />
        </button>
        <button
          className={"save-button " + (saved ? "saved" : "")}
          aria-label={saved ? "Unsave " + look.title : "Save " + look.title}
          onClick={() => onSave(look)}
        >
          <Heart size={17} fill={saved ? "currentColor" : "none"} />
        </button>
        <span className="look-tag">{look.occasion}</span>
      </div>
      <div className="look-meta">
        <div>
          <h3>
            <button onClick={() => onOpen(look)}>{look.title}</button>
          </h3>
          <p>
            {look.pieces.length} pieces ·{" "}
            {look.pieces.some((p) => p.owned)
              ? "mix of yours + new"
              : "curated for you"}
          </p>
        </div>
        <span>
          {money(total(look))}
          <small>to add</small>
        </span>
      </div>
    </article>
  );
}

export default function Atelier() {
  const [state, setState] = useState<State>(INITIAL);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>("discover");
  const [mobile, setMobile] = useState(false);
  const [toast, setToast] = useState("");
  const [storageError, setStorageError] = useState(false);
  const [brief, setBrief] = useState("");
  const [occasion, setOccasion] = useState("Everyday");
  const [seed, setSeed] = useState(0);
  const [mode, setMode] = useState<"shop" | "closet">("shop");
  const [looks, setLooks] = useState<Look[]>([]);
  const [detail, setDetail] = useState<Look | null>(null);
  const [quiz, setQuiz] = useState(false);
  const [tour, setTour] = useState(false);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Profile>(defaultProfile);
  const [adding, setAdding] = useState(false);
  const [closetFull,setClosetFull]=useState(false);
  const [closetPremium,setClosetPremium]=useState(false);
  const [pendingSave,setPendingSave]=useState<Look|null>(null);
  const [chooseReplacement,setChooseReplacement]=useState(false);
  const [premiumDetails,setPremiumDetails]=useState(false);
  const [savingReplacement,setSavingReplacement]=useState(false);
  const [saveError,setSaveError]=useState('');
  const [uploadStatus,setUploadStatus]=useState("");
  const [pieceName, setPieceName] = useState("");
  const [pieceRole, setPieceRole] = useState("top");
  const [pieceColor, setPieceColor] = useState("");
  const [pieceImage, setPieceImage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [closetFilter, setClosetFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [planDate, setPlanDate] = useState<string | null>(null);
  const [week, setWeek] = useState(0);
  const [addingInspo, setAddingInspo] = useState(false);
  const [inspoImage, setInspoImage] = useState("");
  const [inspoNote, setInspoNote] = useState("");
  const [info, setInfo] = useState(false);
  const [guest, setGuest] = useState(false);
  const [activeProfile, setActiveProfile] = useState(false);
  const [gate, setGate] = useState(false);
  const [colorPath, setColorPath] = useState<'known'|'photo'|'manual'>('photo');
  const [seasonNote, setSeasonNote] = useState('');
  const member = state.configured && activeProfile;
  const effectiveProfile = { ...(member ? state.profile : defaultProfile), outfitBrief: brief };
  function buildLooks(profile:Profile,occasion:string,seed=0,closet:Piece[]=[],closetFirst=false,extra:string[]=[]){return buildFreshLooks(profile,occasion,seed,closet,closetFirst,[...state.seenLooks,...extra]);}
  const notify = (message: string) => setToast(message);
  useEffect(() => {
    async function restore(){try {
      setGuest(sessionStorage.getItem("atelier.guest") === "yes");
      const saved = await readOfflineState().catch(()=>undefined) || localStorage.getItem(STORE);
      if (saved) {
        const s = JSON.parse(saved);
        if (
          s &&
          s.profile &&
          typeof s.profile.name === "string" &&
          Array.isArray(s.saved) &&
          Array.isArray(s.closet) &&
          s.plans &&
          Array.isArray(s.inspiration)
        ) {
          setActiveProfile(s.configured && sessionStorage.getItem("atelier.session") !== "signedout");
          setState({
            ...INITIAL,
            ...s,
            profile: { ...defaultProfile, ...s.profile, budget: normalizeBudget(s.profile.budget) },
          });
        }
      }
    } catch {
      setStorageError(true);
    }
    setReady(true);}
    void restore();
    const sync = () => {
      const value = window.location.hash.slice(1);
      if ([...views.map((x) => x.id), "profile"].includes(value))
        setView(value as View);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  useEffect(() => {
    if (!ready) return;
    let active=true;
    writeOfflineState(JSON.stringify(state)).then(()=>{if(active)setStorageError(false);}).catch(()=>{if(active)setStorageError(true);});
    return ()=>{active=false;};
  }, [state, ready]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(t);
  }, [toast]);
  function requireProfile() { if(member)return true; setGate(true);return false; }
  function continueGuest() {setGuest(true);sessionStorage.setItem('atelier.guest','yes');setGate(false);setQuiz(false);setDetail(null);setLooks(buildLooks(defaultProfile,'Everyday',0));setView('style');window.location.hash='style';}
  useEffect(()=>{if(!ready||member)return;if(['closet','lookbook','planner','profile'].includes(view)||(!guest&&view!=='discover')){setGate(true);setView('discover');window.history.replaceState(null,'','#discover');}},[ready,member,guest,view]);
  function go(next: View) {
    if(!member && (['closet','lookbook','planner','profile'].includes(next) || !guest)){setGate(true);setMobile(false);return;}
    setView(next);
    window.location.hash = next;
    setMobile(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function startProfile() {
    setGate(false);
    setDraft({ ...state.profile });
    setStep(0);
    setQuiz(true);
  }
  function saveLook(look: Look) {
    if(!requireProfile())return;
    const exists=state.saved.some(x=>lookKey(x)===lookKey(look));
    if(!exists&&!saveToLookbook(state.saved,look,state.plan)){setPendingSave(look);setChooseReplacement(false);setPremiumDetails(false);setSaveError('');return;}
    setState(s=>({...s,saved:exists?s.saved.filter(x=>lookKey(x)!==lookKey(look)):saveToLookbook(s.saved,look,s.plan)||s.saved}));
    notify(exists?'Removed from your lookbook':'Saved to your lookbook');
  }
  async function completePendingSave(replaceId?:string,premium=false){
    if(!pendingSave||savingReplacement)return;
    const plan=premium?'premium':state.plan;
    const saved=saveToLookbook(state.saved,pendingSave,plan,replaceId);
    if(!saved){setSaveError('There is not enough room yet. Remove an older look or choose Premium.');return;}
    setSavingReplacement(true);setSaveError('');
    const next={...state,plan,saved} as State;
    try{await writeOfflineState(JSON.stringify(next));setState(next);setPendingSave(null);notify(replaceId?'New look saved. Your selected look was replaced.':'Saved to your lookbook');}
    catch{setSaveError('Could not save your new look. Your older looks are unchanged. Please try again.');}
    finally{setSavingReplacement(false);}
  }
  function generate(nextSeed = seed + 1) {
    if(!member && !guest){setGate(true);return;}
    if (mode === "closet" && !state.closet.length) {
      go("closet");
      notify("Add a piece to start styling your closet.");
      return;
    }
    const next = buildLooks(
      effectiveProfile,
      occasion,
      nextSeed,
      state.closet,
      mode === "closet",
    );
    setSeed(nextSeed);
    setLooks(next);
    go("style");
    if (!next.length)
      notify(
        "No new matching looks in this preview catalog. Try another request or budget; your previous looks will not be repeated.",
      );
  }
  const {suggestions,displayedLooks}=useMemo(()=>{
    const suggestions=buildLooks(effectiveProfile,occasion,0,[],false).slice(0,3);
    const displayed=looks.length?looks:buildLooks(effectiveProfile,occasion,seed,state.closet,mode==="closet");
    return {suggestions,displayedLooks:displayed};
  },[ready,member,state.profile,state.saved,state.closet,occasion,brief,seed,mode,looks,view]);
  useEffect(()=>{
    if(!ready)return;
    const shown=view==='discover'?suggestions:view==='style'?displayedLooks:[];
    const keys=shown.map(lookKey);
    if(keys.some(key=>!state.seenLooks.includes(key)))setState(s=>({...s,seenLooks:[...new Set([...s.seenLooks,...keys])]}));
  },[ready,view,suggestions,displayedLooks,state.seenLooks]);
  const colors = palettes[effectiveProfile.season] || palettes["Soft Autumn"];
  function finishProfile() {
    if (!state.configured) setTour(true);
    setActiveProfile(true);setGuest(false);sessionStorage.setItem("atelier.session","active");sessionStorage.removeItem("atelier.guest");
    setState((s) => ({ ...s, profile: draft, configured: true }));
    setQuiz(false);
    setLooks(
      buildLooks(draft, occasion, seed, state.closet, mode === "closet"),
    );
    setView("style");window.location.hash="style";
    notify("Your style profile is ready. Let’s get dressed.");
  }
  function addPiece() {
    if(!requireProfile())return;
    if(!canAddPieces(state.plan,state.closet.length,1)){setClosetPremium(false);setClosetFull(true);return;}
    if (!pieceName.trim()) {
      notify("Give this piece a name first.");
      return;
    }
    setState((s) => ({
      ...s,
      closet: [
        {
          id: "owned-" + Date.now(),
          name: pieceName.trim(),
          role: pieceRole,
          color: pieceColor.trim(),
          brand: "Your closet",
          price: 0,
          shopUrl: "",
          image: pieceImage,
          owned: true,
        },
        ...s.closet,
      ],
    }));
    setAdding(false);
    setPieceName("");
    setPieceColor("");
    setPieceImage("");
    notify("Added to your closet");
  }
  function exportPlan() {
    const text = Array.from({ length: 7 }, (_, i) => dateAt(week * 7 + i))
      .map(
        (d) =>
          `${dateLabel(d)}\n${state.plans[d] ? state.plans[d].title + "\n" + state.plans[d].pieces.map((p) => `- ${p.name}${p.owned ? " (owned)" : ""}`).join("\n") : "No outfit planned"}\n`,
      )
      .join("\n");
    const u = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = u;
    a.download = "atelier-week.txt";
    a.click();
    URL.revokeObjectURL(u);
  }
  return (
    <div className="app" onClickCapture={e=>{if(!ready||member||guest||gate||quiz)return;const target=e.target as HTMLElement;if(target.closest('button,a')){e.preventDefault();e.stopPropagation();setGate(true);}}}>
      <a href="#main" className="skip">
        Skip to content
      </a>
      <aside className={"sidebar " + (mobile ? "open" : "")}>
        <button
          className="brand"
          onClick={() => go("discover")}
          aria-label="Atelier home"
        >
          <img src="/images/cherry.svg" alt="" />
          <span>
            atelier<span className="brand-dot">.</span>
          </span>
        </button>
        <p className="brand-note">A LITTLE MORE YOU.</p>
        <nav aria-label="Main navigation">
          {views.map((n) => (
            <button
              key={n.id}
              onClick={() => go(n.id)}
              className={"nav-item " + (view === n.id ? "active" : "")}
              aria-current={view === n.id ? "page" : undefined}
            >
              <n.icon size={18} />
              {n.label}
              {n.id === "lookbook" && state.saved.length > 0 && (
                <span className="count">{state.saved.length}</span>
              )}
              {view === n.id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="tiny-star">✧</span>
          <h3>
            Less buying.
            <br />
            More possibilities.
          </h3>
          <p>Your next favorite outfit might already be in your closet.</p>
          <button onClick={() => go("closet")}>
            Rediscover your wardrobe <ArrowRight size={14} />
          </button>
        </div>
        <button
          className={"profile-link " + (view === "profile" ? "active" : "")}
          onClick={() => go("profile")}
        >
          <span className="avatar">
            {state.profile.name ? (
              state.profile.name[0].toUpperCase()
            ) : (
              <UserRound size={18} />
            )}
          </span>
          <span>
            {state.profile.name || "Make it yours"}
            <small>
              {member
                ? "Your style profile"
                : "Create your style profile"}
            </small>
          </span>
          <ArrowUpRight size={16} />
        </button>
      </aside>
      {mobile && (
        <button
          className="mobile-overlay"
          onClick={() => setMobile(false)}
          aria-label="Close navigation"
        />
      )}
      <div className="workspace">
        <header className="topbar">
          <button
            className="mobile-menu icon-button"
            aria-label="Open navigation"
            onClick={() => setMobile(true)}
          >
            <Menu size={22} />
          </button>
          <span className="breadcrumb">
            Your personal style space <span>/</span>{" "}
            <strong>
              {view === "profile"
                ? "Your profile"
                : views.find((x) => x.id === view)?.label}
            </strong>
          </span>
          <div className="top-actions">
            <span className="season-note">
              <span /> THE EVERYDAY EDIT
            </span>
            <button
              className="small-avatar"
              aria-label="Your profile"
              onClick={() => go("profile")}
            >
              {state.profile.name?.[0]?.toUpperCase() || (
                <UserRound size={15} />
              )}
            </button>
          </div>
        </header>
        {storageError && (
          <div className="storage-warning" role="alert">
            Your browser could not save these changes. Free up browser storage
            before adding more photos. Keep this tab open to retain your work.
          </div>
        )}
        <main id="main" tabIndex={-1}>
          {view === "discover" && (
            <>
              <section className="intro">
                <div>
                  <p className="eyebrow">YOUR EVERYDAY, BEAUTIFULLY DRESSED</p>
                  <h1>
                    {member && state.profile.name ? (
                      <>
                        A little inspiration, <em>{state.profile.name}.</em>
                      </>
                    ) : (
                      <>
                        Good style. <em>More you.</em>
                      </>
                    )}
                  </h1>
                  <p>
                    Less “nothing to wear.” More outfits that feel just right.
                  </p>
                </div>
                <button
                  className="text-link intro-action"
                  onClick={startProfile}
                >
                  {member
                    ? "Refine your style"
                    : "Make this personal"}{" "}
                  <SlidersHorizontal size={15} />
                </button>
              </section>
              <section className="hero">
                <div className="hero-copy">
                  <span className="hero-kicker">
                    <span className="line" /> THE ART OF GETTING DRESSED
                  </span>
                  <h2>
                    Your wardrobe.
                    <br />A world of
                    <br />
                    <em>possibilities.</em>
                  </h2>
                  <p>
                    Discover looks that work with your colors,
                    <br className="desktop" /> your budget, and the pieces you
                    already love.
                  </p>
                  <button
                    className="primary"
                    onClick={() =>
                      member || guest ? generate() : startProfile()
                    }
                  >
                    Find my next outfit <ArrowUpRight size={17} />
                  </button>
                  <span className="hero-footnote">
                    A little inspiration. A lot of you.
                  </span>
                </div>
                <div className="hero-photo">
                  <img src="/images/editorial-0.webp" alt="Full-body outfit with a camel jacket, cream knit, and tailored trousers" fetchPriority="high"/>
                  <span className="photo-caption">01 / THE EFFORTLESS EDIT</span>
                  <div className="floating-note"><span className="note-sparkle">✧</span><div>Already your style.<small>Just a new way to wear it.</small></div></div>
                </div>
              </section>
              <div className="utility-row">
                <button onClick={() => go("closet")}>
                  <span className="utility-icon">
                    <Shirt size={21} />
                  </span>
                  <span>
                    Start with what you own
                    <small>A fresh perspective on your closet</small>
                  </span>
                  <ArrowUpRight size={17} />
                </button>
                <button onClick={() => go("planner")}>
                  <span className="utility-icon">
                    <CalendarDays size={21} />
                  </span>
                  <span>
                    A well-dressed week
                    <small>A little planning. Easier mornings.</small>
                  </span>
                  <ArrowUpRight size={17} />
                </button>
                <button onClick={() => go("inspiration")}>
                  <span className="utility-icon">
                    <ImagePlus size={21} />
                  </span>
                  <span>
                    Save a little inspiration
                    <small>Keep the looks you want to revisit</small>
                  </span>
                  <ArrowUpRight size={17} />
                </button>
              </div>
              <section className="section">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">CONSIDERED, NOT COMPLICATED</p>
                    <h2>
                      {member
                        ? "An edit just for you"
                        : "Popular outfit inspiration"}
                    </h2>
                  </div>
                  <button className="text-link" onClick={() => go("style")}>
                    Explore your stylist <ArrowRight size={16} />
                  </button>
                </div>

              <div className="filter-row">
                  <div className="chips">
                    {occasions.map((o) => (
                      <Toggle
                        key={o}
                        selected={occasion === o}
                        onClick={() => setOccasion(o)}
                      >
                        {o}
                      </Toggle>
                    ))}
                  </div>
                  <span className="muted small">
                    Within {money(state.profile.budget)} / outfit
                  </span>
                </div>
                <div className="look-grid">
                  {suggestions.map((l) => (
                    <LookCard
                      key={l.id}
                      look={l}
                      saved={state.saved.some((x) => x.id === l.id)}
                      onOpen={setDetail}
                      onSave={saveLook}
                    />
                  ))}
                </div>
              </section>
              <section className="palette-banner">
                <div className="palette-copy">
                  <p className="eyebrow">YOUR TRUE COLORS</p>
                  <h2>
                    Find your kind of <em>glow.</em>
                  </h2>
                  <p>A palette that makes getting dressed feel natural.</p>
                  <button
                    className="text-link"
                    onClick={() => {
                      setDraft(state.profile);
                      if(!requireProfile())return;
                      setStep(1);
                      setQuiz(true);
                    }}
                  >
                    Explore your palette <ArrowRight size={16} />
                  </button>
                </div>
                <div className="large-swatches">
                  {colors.map((c) => (
                    <span key={c} style={{ background: c }} />
                  ))}
                </div>
                <div className="palette-label">
                  <span>
                    {member
                      ? state.profile.season
                      : "Explore seasonal color"}
                  </span>
                  <small>
                    {member
                      ? "Your selected palette"
                      : "12 palettes. Find the one that feels like you."}
                  </small>
                </div>
              </section>
            </>
          )}
          {view === "style" && (
            <>
              <section className="page-heading">
                <p className="eyebrow">THOUGHTFULLY PUT TOGETHER</p>
                <h1>
                  Your next <em>favorite outfit.</em>
                </h1>
                <p>
                  Start with your wardrobe or discover something new. Every edit
                  respects your budget.
                </p>
              </section>
              <div className="stylist-controls">
                <div className="segmented">
                  <button
                    className={mode === "shop" ? "active" : ""}
                    onClick={() => {
                      setMode("shop");
                      setLooks([]);
                    }}
                  >
                    Discover new pieces
                  </button>
                  <button
                    className={mode === "closet" ? "active" : ""}
                    onClick={() => {
                      setMode("closet");
                      setLooks([]);
                    }}
                  >
                    Style my closet
                  </button>
                </div>
                <button className="text-link" onClick={startProfile}>
                  <SlidersHorizontal size={16} /> Preferences
                </button>
              </div>
              <label className="outfit-brief">What are you dressing for? <span>Optional</span>
                <textarea value={brief} maxLength={500} rows={2} onChange={e=>{setBrief(e.target.value);setLooks([]);}} placeholder="Brunch with my in-laws — cute and modest, with a skirt" />
                <small>Add the occasion, a piece you want, or a detail you love.</small>
              </label>
<div className="filter-row">
                <div className="chips">
                  {occasions.map((o) => (
                    <Toggle
                      key={o}
                      selected={occasion === o}
                      onClick={() => {
                        setOccasion(o);
                        setLooks([]);
                      }}
                    >
                      {o}
                    </Toggle>
                  ))}
                </div>
                <button className="primary" onClick={() => generate()}>
                  <Sparkles size={16} /> Refresh my edit
                </button>
              </div>
              {mode === "closet" && !state.closet.length ? (
                <div className="empty">
                  <Shirt />
                  <h2>Let’s meet your wardrobe.</h2>
                  <p>Add a few pieces, then we’ll build outfits around them.</p>
                  <button className="primary" onClick={() => go("closet")}>
                    Add your first piece <Plus size={16} />
                  </button>
                </div>
              ) : (
                <>
                  <div className="style-summary">
                    <span>
                      <CheckCircle2 size={14} /> Under{" "}
                      {money(effectiveProfile.budget)} in new pieces
                    </span>
                    <span>{effectiveProfile.season} palette preferences</span>
                    <span>{effectiveProfile.vibes.join(" · ")}</span>
                  </div>
                  {!displayedLooks.length && <p role="status" className="dialog-notice">No new matching looks left for these preferences. Try another detail or budget, or revisit your saved looks.</p>}
                  <div className="look-grid style-grid">
                    {displayedLooks.map((l) => (
                      <LookCard
                        key={l.id}
                        look={l}
                        saved={state.saved.some((x) => x.id === l.id)}
                        onOpen={setDetail}
                        onSave={saveLook}
                      />
                    ))}
                  </div>
                  {!displayedLooks.length && (
                    <div className="empty">
                      <h2>A little more room?</h2>
                      <p>
                        We couldn’t make a complete outfit within this budget.
                        Add owned pieces or adjust your budget.
                      </p>
                      <button className="primary" onClick={startProfile}>
                        Adjust preferences
                      </button>
                    </div>
                  )}
                  <p className="fine-print">
                    Outfits are matched from Atelier’s curated catalog using
                    your preferences. Catalog prices are estimates; confirm
                    price and availability at the retailer.
                  </p>
                </>
              )}
            </>
          )}
          {view === "lookbook" && (
            <>
              <section className="page-heading">
                <p className="eyebrow">THE ONES YOU LOVE</p>
                <h1>
                  Your personal <em>lookbook.</em>
                </h1>
                <p>
                  {state.saved.length} of {savedLookLimit(state.plan)} saved{" "}
                  {state.saved.length === 1 ? "outfit" : "outfits"}. A little
                  collection of what feels like you.
                </p>
              </section>
              {state.saved.length ? (
                <div className="look-grid">
                  {state.saved.map((l) => (
                    <LookCard
                      key={l.id}
                      look={l}
                      saved={state.saved.some((x) => x.id === l.id)}
                      onOpen={setDetail}
                      onSave={saveLook}
                    />
                  ))}
                </div>
              ) : (
                <div className="empty">
                  <Heart />
                  <h2>Keep the good ones.</h2>
                  <p>
                    Tap the heart on an outfit to save it here. Plan it for
                    tomorrow or come back whenever inspiration strikes.
                  </p>
                  <button className="primary" onClick={() => go("style")}>
                    Find something to love <ArrowRight size={16} />
                  </button>
                </div>
              )}
            </>
          )}
          {view === "closet" && (
            <>
              <section className="page-heading heading-flex">
                <div>
                  <p className="eyebrow">MORE FROM WHAT YOU OWN</p>
                  <h1>
                    A closet full of <em>possibility.</em>
                  </h1>
                  <p>
                    {state.closet.length} / {closetLimit(state.plan)} pieces · {state.plan === "free" ? "Free" : "Premium preview"}
                  </p>
                </div>
                <div className="closet-heading-actions">
                <button className="primary" onClick={() => {if(!requireProfile())return;if(state.closet.length>=closetLimit(state.plan)){setClosetPremium(false);setClosetFull(true);return;}setAdding(true);}}>
                  <Plus size={17} /> Add clothes
                </button>
                  <button className="secondary" onClick={() => {
                    if (!requireProfile()) return;
                    setMode("closet");
                    setLooks(buildLooks(state.profile, occasion, seed, state.closet, true));
                    go("style");
                  }}><Sparkles size={17} /> Style my closet</button>
                </div>
              </section>
              <details className="preview-plan"><summary>Preview Free / Premium capacity</summary><p>For testing only. This does not purchase or activate a subscription.</p><label>Preview plan <select value={state.plan} onChange={e=>setState(s=>({...s,plan:e.target.value as ClosetPlan}))}><option value="free">Free · 10 items</option><option value="premium">Premium · 100 items</option></select></label></details>
              <div className="closet-toolbar">
                <label className="search">
                  <Search size={17} />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Find a piece…"
                    aria-label="Search your closet"
                  />
                </label>
                <div className="chips">
                  {[
                    "All",
                    "top",
                    "bottom",
                    "dress",
                    "shoes",
                    "outerwear",
                    "bag",
                    "accessory",
                  ].map((c) => (
                    <Toggle
                      key={c}
                      selected={closetFilter === c}
                      onClick={() => setClosetFilter(c)}
                    >
                      {c === "All"
                        ? "All pieces"
                        : c === "accessory"
                          ? "Accessories"
                          : c[0].toUpperCase() + c.slice(1)}
                    </Toggle>
                  ))}
                </div>
              </div>
              {state.closet.length ? (
                <>
                  <div className="closet-grid">
                    {state.closet
                      .filter(
                        (p) =>
                          (closetFilter === "All" || p.role === closetFilter) &&
                          (p.name + " " + p.color)
                            .toLowerCase()
                            .includes(search.toLowerCase()),
                      )
                      .map((p) => (
                        <article className="closet-piece" key={p.id}>
                          <div className="closet-photo">
                            <ProductImage piece={p} />
                            <button
                              className="save-button"
                              aria-label={"Remove " + p.name}
                              onClick={() => {
                                setState((s) => ({
                                  ...s,
                                  closet: s.closet.filter((x) => x.id !== p.id),
                                }));
                                notify("Piece removed from your closet");
                              }}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                          <p className="eyebrow">
                            {p.role} {p.color && " / " + p.color}
                          </p>
                          <h3>{p.name}</h3>
                          <PieceEditor value={p} readPhoto={readPhoto} onChange={updated=>setState(s=>({...s,closet:s.closet.map(x=>x.id===p.id?{...x,...updated}:x)}))}/>
                          <button
                            className="text-link"
                            onClick={() => {
                              setMode("closet");
                              setLooks(
                                buildLooks(
                                  state.profile,
                                  occasion,
                                  seed,
                                  [p],
                                  true,
                                ),
                              );
                              go("style");
                            }}
                          >
                            Style this piece <Sparkles size={13} />
                          </button>
                        </article>
                      ))}
                  </div>
                  <button
                    className="primary"
                    onClick={() => {
                      setMode("closet");
                      setLooks(
                        buildLooks(
                          state.profile,
                          occasion,
                          seed,
                          state.closet,
                          true,
                        ),
                      );
                      go("style");
                    }}
                  >
                    Make more of my closet <ArrowRight size={16} />
                  </button>
                </>
              ) : (
                <div className="closet-empty">
                  <div className="closet-illustration">
                    <Shirt size={66} strokeWidth={0.8} />
                    <span>
                      YOUR NEXT GREAT OUTFIT
                      <br />
                      IS ALREADY IN HERE.
                    </span>
                  </div>
                  <div>
                    <p className="eyebrow">START SMALL. STYLE MORE.</p>
                    <h2>
                      Five favorites.
                      <br />A whole new perspective.
                    </h2>
                    <p>
                      Add a photo of a piece you love, or enter it by hand.
                      We’ll help you work it into something new.
                    </p>
                    <p>Use <strong>Add clothes</strong> above to get started.</p>
                    <small>
                      Photos stay in this browser. You’re in control.
                    </small>
                  </div>
                </div>
              )}
            </>
          )}
          {view === "planner" && (
            <>
              <section className="page-heading heading-flex">
                <div>
                  <p className="eyebrow">GOOD MORNINGS START HERE</p>
                  <h1>
                    A well-dressed <em>week.</em>
                  </h1>
                  <p>
                    Make space for your day. Give every outfit a place to go.
                  </p>
                </div>
                <button className="secondary" onClick={exportPlan}>
                  <Download size={16} /> Export week
                </button>
              </section>
              <div className="week-nav">
                <button
                  className="icon-button"
                  aria-label="Previous week"
                  onClick={() => setWeek((x) => x - 1)}
                >
                  <ChevronLeft size={20} />
                </button>
                <h3>
                  {dateLabel(dateAt(week * 7))} —{" "}
                  {dateLabel(dateAt(week * 7 + 6))}
                </h3>
                <button
                  className="icon-button"
                  aria-label="Next week"
                  onClick={() => setWeek((x) => x + 1)}
                >
                  <ChevronRight size={20} />
                </button>
                <button className="text-link" onClick={() => setWeek(0)}>
                  This week
                </button>
              </div>
              <div className="planner-grid">
                {Array.from({ length: 7 }, (_, i) => dateAt(week * 7 + i)).map(
                  (d) => (
                    <article
                      key={d}
                      className={"day " + (d === today() ? "today" : "")}
                    >
                      <header>
                        <span>
                          {new Date(d + "T12:00:00").toLocaleDateString(
                            "en-US",
                            { weekday: "short" },
                          )}
                        </span>
                        <strong>{new Date(d + "T12:00:00").getDate()}</strong>
                        {d === today() && <small>TODAY</small>}
                      </header>
                      {state.plans[d] ? (
                        <>
                          <button
                            className="planned-look"
                            onClick={() => setDetail(state.plans[d])}
                          >
                            <Board look={state.plans[d]} />
                            <h3>{state.plans[d].title}</h3>
                          </button>
                          <button
                            className="text-link"
                            onClick={() => {if(requireProfile())setPlanDate(d);}}
                          >
                            Change outfit
                          </button>
                          <button
                            className="remove-plan"
                            aria-label={"Remove outfit for " + d}
                            onClick={() =>
                              setState((s) => {
                                const plans = { ...s.plans };
                                delete plans[d];
                                return { ...s, plans };
                              })
                            }
                          >
                            <X size={14} />
                          </button>
                        </>
                      ) : (
                        <button
                          className="add-day"
                          onClick={() => {if(requireProfile())setPlanDate(d);}}
                        >
                          <Plus size={20} />
                          <span>Plan a look</span>
                        </button>
                      )}
                    </article>
                  ),
                )}
              </div>
              <div className="planner-tip">
                <Sparkles size={19} />
                <p>
                  <strong>Going somewhere?</strong> Plan a few looks, then
                  export your week as a packing checklist.
                </p>
              </div>
            </>
          )}
          {view === "inspiration" && (
            <>
              <section className="page-heading heading-flex">
                <div>
                  <p className="eyebrow">LET’S FIND YOUR STYLE</p>
                  <h1>
                    A little <em>inspiration.</em>
                  </h1>
                  <p>
                    Twelve different outfits. Swipe right for “love it,” left for “not for me.” Your choices help shape your next edit.
                  </p>
                </div>
                <button
                  className="primary"
                  onClick={() => {if(requireProfile())setAddingInspo(true);}}
                >
                  <Plus size={17} /> Save inspiration
                </button>
              </section>
              <TasteDeck renderLook={look=><Board look={look}/>} onPreferences={(likedPieces,dislikedPieces,likedLookIds)=>{setState(s=>({...s,profile:{...s.profile,likedPieces,dislikedPieces,likedLookIds}}));setLooks([]);}} />
              <div className="inspo-grid">
                {state.inspiration.map((i) => (
                  <article key={i.id}>
                    <div className="inspo-image">
                      <img
                        src={i.image}
                        alt={i.note || "Your saved outfit inspiration"}
                      />
                      <button
                        className="save-button"
                        aria-label="Remove inspiration"
                        onClick={() =>
                          setState((s) => ({
                            ...s,
                            inspiration: s.inspiration.filter(
                              (x) => x.id !== i.id,
                            ),
                          }))
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <h3>{i.note || "Something worth saving"}</h3>
                    <button className="text-link" onClick={startProfile}>
                      Bring this into my style <ArrowUpRight size={15} />
                    </button>
                  </article>
                ))}
              </div>

            </>
          )}
          {view === "profile" && (
            <>
              <section className="page-heading heading-flex">
                <div>
                  <p className="eyebrow">PERSONAL STYLE IS PERSONAL</p>
                  <h1>
                    {member && state.profile.name ? (
                      <>
                        The <em>{state.profile.name}</em> edit.
                      </>
                    ) : (
                      <>
                        A little more <em>you.</em>
                      </>
                    )}
                  </h1>
                  <p>
                    Your preferences help make every edit feel like your own.
                  </p>
                </div>
                <button className="primary" onClick={startProfile}>
                  {member
                    ? "Edit your profile"
                    : "Create your profile"}{" "}
                  <ArrowUpRight size={16} />
                </button>
              </section>
              <div className="profile-grid">
                <section className="profile-card">
                  <span className="eyebrow">YOUR PALETTE</span>
                  <h2>{state.profile.season}</h2>
                  <div className="swatches">
                    {colors.map((c) => (
                      <span key={c} style={{ background: c }} />
                    ))}
                  </div>
                  <p>
                    {member
                      ? "Your selected color direction."
                      : "A starting palette to explore. Choose your own in your profile."}
                  </p>
                  <button
                    className="text-link"
                    onClick={() => {
                      setDraft(state.profile);
                      if(!requireProfile())return;
                      setStep(1);
                      setQuiz(true);
                    }}
                  >
                    Explore all 12 palettes <ArrowRight size={15} />
                  </button>
                </section>
                <section className="profile-card">
                  <span className="eyebrow">YOUR STYLE</span>
                  <h2>{state.profile.vibes.join(" / ")}</h2>
                  <p>
                    For {state.profile.occasions.join(", ").toLowerCase()} and
                    everything in between.
                  </p>
                </section>
                <section className="profile-card">
                  <span className="eyebrow">YOUR BUDGET</span>
                  <h2>
                    {money(state.profile.budget)} <small>/ outfit</small>
                  </h2>
                  <p>For new pieces. Clothes you already own count as $0.</p>
                </section>
              </div>
              <button className="secondary" onClick={()=>{setActiveProfile(false);setGuest(true);sessionStorage.setItem("atelier.session","signedout");sessionStorage.setItem("atelier.guest","yes");setView("discover");window.location.hash="discover";}}>Leave profile · browse as guest</button>
              <section className="privacy-note">
                <UserRound size={20} />
                <div>
                  <h3>Your style. Your space.</h3>
                  <p>
                    Your profile, photos, saved looks, and plans are stored in
                    this browser. This version does not sync between devices. No
                    account or body photos required.
                  </p>
                </div>
              </section>
            </>
          )}
        </main>
        <footer>
          <span className="footer-brand">atelier.</span>
          <span>Wear what feels like you.</span>
          <button onClick={() => setInfo(true)}>About & privacy</button>
          {member && <button onClick={() => setTour(true)}>Take a tour</button>}
        </footer>
      </div>
      {uploadStatus&&!adding&&member&&<aside className="upload-notification" role="status"><div><strong>Closet upload</strong><p>{uploadStatus}</p>{/Finding pieces|Creating cutout|Preparing photos/.test(uploadStatus)&&<small>Feel free to explore—just keep this tab open.</small>}</div><button className="secondary" onClick={()=>setAdding(true)}>Review upload</button></aside>}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={17} />
          {toast}
        </div>
      )}
      <nav className="mobile-bottom" aria-label="Mobile app navigation">{views.filter(n=>['discover','style','lookbook','closet','planner'].includes(n.id)).map(n=><button key={n.id} aria-current={view===n.id?'page':undefined} className={view===n.id?'active':''} onClick={()=>go(n.id)}><n.icon size={20}/><span>{n.id==='discover'?'Home':n.id==='style'?'Style':n.id==='closet'?'Closet':n.id==='planner'?'Planner':'Saved'}</span></button>)}</nav>
      {tour && <Modal title="Your Atelier guide" onClose={() => setTour(false)}><Walkthrough onClose={() => setTour(false)} /></Modal>}
      {closetFull&&<Modal title="Your closet is full" onClose={()=>setClosetFull(false)}>
        <h2>Your closet is <em>full.</em></h2>
        <p>You’ve filled your {closetLimit(state.plan)} {state.plan==='free'?'Free':'Premium'} closet spaces. {state.plan==='free'?'Explore Premium for more room, or remove a piece you no longer need.':'Remove a piece you no longer need to make room for something new.'}</p>
        {!closetPremium?<div className="save-limit-actions">{state.plan==='free'&&<button className="primary" onClick={()=>setClosetPremium(true)}>Explore Premium</button>}<button className="secondary" onClick={()=>{setClosetFull(false);setAdding(false);go('closet');}}>Manage my closet</button><button className="text-link" onClick={()=>setClosetFull(false)}>Not now</button></div>:<section><h3>More room for your wardrobe</h3><p>Premium preview includes 100 closet pieces and 100 saved looks.</p><p className="fine-print">Local preview only. This does not start a paid subscription or charge you.</p><button className="primary full" onClick={()=>{setState(s=>({...s,plan:'premium'}));setClosetFull(false);setAdding(true);}}>Try Premium preview</button><button className="text-link" onClick={()=>setClosetPremium(false)}>Back</button></section>}
      </Modal>}
      {pendingSave&&<Modal title="Your lookbook is full" wide onClose={()=>{if(!savingReplacement)setPendingSave(null);}}>
        <h2>Make room for <em>one more favorite.</em></h2>
        <p>{state.saved.length} of {savedLookLimit(state.plan)} saved looks. {state.plan==='free'?'Explore Premium for more room, or choose a saved look to replace.':'Choose a saved look to replace.'}</p>
        <div className="pending-look"><Board look={pendingSave}/><h3>{pendingSave.title}</h3><small>Your new look stays here while you decide.</small></div>
        {saveError&&<p role="alert">{saveError}</p>}
        {!chooseReplacement&&!premiumDetails&&<div className="save-limit-actions">{state.plan==='free'&&<button className="primary" onClick={()=>setPremiumDetails(true)}>Explore Premium</button>}<button className="secondary" onClick={()=>setChooseReplacement(true)}>Choose a look to replace</button><button className="text-link" onClick={()=>setPendingSave(null)}>Not now</button></div>}
        {premiumDetails&&<section><h3>More room for your style</h3><p>Premium preview: 100 saved looks and 100 closet pieces.</p><p className="fine-print">Local preview only. This does not start a paid subscription or charge you.</p><button className="primary full" disabled={savingReplacement} onClick={()=>completePendingSave(undefined,true)}>Try Premium preview &amp; save this look</button><button className="text-link" disabled={savingReplacement} onClick={()=>setPremiumDetails(false)}>Back</button></section>}
        {chooseReplacement&&<section><h3>Which look would you like to replace?</h3><p>Oldest saved looks appear first. Your new look is saved before the replacement is confirmed.</p><div className="replacement-looks">{[...state.saved].reverse().map(look=><article key={look.id}><Board look={look}/><h4>{look.title}</h4><button className="secondary full" disabled={savingReplacement} onClick={()=>completePendingSave(look.id)}>Replace this look</button></article>)}</div><button className="text-link" disabled={savingReplacement} onClick={()=>setChooseReplacement(false)}>Back</button></section>}
        {savingReplacement&&<p role="status">Saving your new look…</p>}
      </Modal>}
      {gate && <Modal title="Make Atelier yours" onClose={()=>setGate(false)}><h2>Your wardrobe.<br/><em>Your own kind of style.</em></h2><p>Create a profile for personal recommendations, your closet, saved looks, and outfit planning.</p><button className="primary full" onClick={startProfile}>Create my profile <ArrowRight size={16}/></button>{state.configured&&<button className="secondary full" onClick={()=>{setActiveProfile(true);sessionStorage.setItem('atelier.session','active');setGate(false);setGuest(false);setView('profile');window.location.hash='profile';}}>Use saved profile: {state.profile.name}</button>}<button className="text-link guest-skip" onClick={continueGuest}>Not now — explore popular looks</button><p className="fine-print">This offline preview uses a profile saved on this device. Account sign-in will be connected before launch.</p></Modal>}
      {quiz && (
        <Modal
          notice={toast}
          title="Your style profile"
          onClose={() => setQuiz(false)}
        >
          {!member&&<button className="text-link guest-skip" onClick={continueGuest}>Skip for now — browse popular looks</button>}
          <div className="quiz-progress">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={i <= step ? "done" : ""} />
            ))}
          </div>
          <p className="eyebrow">STEP {step + 1} OF 4</p>
          {step === 0 && (
            <>
              <h2>
                First, a little <em>about you.</em>
              </h2>
              <p className="muted">Let’s make getting dressed feel easier.</p>
              <label className="field">
                What should we call you?
                <input
                  autoComplete="given-name"
                  placeholder="Your first name"
                  maxLength={40}
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </label>
              <label className="field">Which style age feels right?<select value={draft.lookAge||'mixed'} onChange={e=>setDraft({...draft,lookAge:e.target.value})}><option value="mixed">Keep it flexible</option><option value="younger">Younger · early twenties energy</option><option value="mid">Mid · late twenties to forties</option><option value="mature">Mature · a more grown line</option></select></label>
              <details className="fit-details"><summary>Fit, sizing & priorities · optional</summary><div className="fields-row"><label className="field">Clothing size<input value={draft.size||''} onChange={e=>setDraft({...draft,size:e.target.value})} placeholder="e.g. US 8 / M"/></label><HeightInput value={draft.height||''} unit={draft.heightUnit||'cm'} onChange={height=>setDraft(s=>({...s,height}))} onUnitChange={heightUnit=>setDraft(s=>({...s,heightUnit}))}/></div><label className="field">Overall shape<select value={draft.shape||''} onChange={e=>setDraft({...draft,shape:e.target.value})}><option value="">Prefer to skip</option>{['Balanced','Soft middle','Broader shoulders','Long line','Hourglass'].map(v=><option key={v}>{v}</option>)}</select></label><label className="field">Torso<select value={draft.torso||''} onChange={e=>setDraft({...draft,torso:e.target.value})}><option value="">Prefer to skip</option>{['Shorter','Balanced','Longer'].map(v=><option key={v}>{v}</option>)}</select></label><label className="field">What matters most?<select value={draft.priority||'Comfort'} onChange={e=>setDraft({...draft,priority:e.target.value})}>{['Comfort','Easy to combine','A polished look','Expressing myself','More from what I own'].map(v=><option key={v}>{v}</option>)}</select></label></details>
              <p className="field-label">What are you dressing for?</p>
              <div className="chips">
                {occasions.map((o) => (
                  <Toggle
                    key={o}
                    selected={draft.occasions.includes(o)}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        occasions: draft.occasions.includes(o)
                          ? draft.occasions.filter((x) => x !== o)
                          : [...draft.occasions, o],
                      })
                    }
                  >
                    {o}
                  </Toggle>
                ))}
              </div>
            </>
          )}
          {step === 1 && (
            <>
              <h2>
                Your colors. <em>Your glow.</em>
              </h2>
              <p className="muted">Do you already know your color season?</p><div className="chips"><Toggle selected={colorPath==='known'} onClick={()=>setColorPath('known')}>I already know my season</Toggle><Toggle selected={colorPath==='photo'} onClick={()=>setColorPath('photo')}>Analyze my photo</Toggle><Toggle selected={colorPath==='manual'} onClick={()=>setColorPath('manual')}>Explore without a photo</Toggle></div>
              {colorPath==='photo'&&<AutomaticSeason readPhoto={readPhoto} onResult={(season,summary)=>{setDraft(d=>({...d,season}));setSeasonNote(summary);}}/>}
              {seasonNote&&<div className="season-result" role="status"><p className="eyebrow">PHOTO STARTING POINT</p><h3>{draft.season}</h3><p>{seasonNote}</p><p>You can choose a different palette below.</p></div>}
              {colorPath==='manual'&&<p className="fine-print">Compare the swatches with colors you enjoy wearing. You can change your selection any time.</p>}
              <div className="palette-picker">
                {Object.entries(palettes).map(([name, swatches]) => (
                  <button
                    key={name}
                    className={draft.season === name ? "chosen" : ""}
                    onClick={() => setDraft({ ...draft, season: name })}
                    aria-pressed={draft.season === name}
                  >
                    <span className="mini-swatches">
                      {swatches.map((c) => (
                        <i key={c} style={{ background: c }} />
                      ))}
                    </span>
                    <span>
                      {name} {draft.season === name && <Check size={13} />}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <h2>
                What feels like <em>you?</em>
              </h2>
              <p className="muted">
                Pick a direction, or mix a few. Personal style never needs a
                box.
              </p>
              <div className="vibe-grid">
                {vibes.map((v, i) => (
                  <button
                    key={v}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        vibes: draft.vibes.includes(v)
                          ? draft.vibes.filter((x) => x !== v)
                          : [...draft.vibes, v],
                      })
                    }
                    className={draft.vibes.includes(v) ? "chosen" : ""}
                    aria-pressed={draft.vibes.includes(v)}
                  >
                    <img
                      src={"/images/editorial-" + [1, 4, 3, 2][i] + ".webp"}
                      alt=""
                    />
                    <span>
                      {v} {draft.vibes.includes(v) && <Check size={16} />}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
          {step === 3 && (
            <>
              <h2>
                Good style, <em>your budget.</em>
              </h2>
              <p className="muted">
                How much would you like to spend on a complete outfit? Your own
                pieces are always free to style.
              </p>
              <div className="budget-value">
                {money(draft.budget)}
                <small>maximum per outfit</small>
              </div>
              <label className="sr-only" htmlFor="budget">
                Maximum outfit budget
              </label>
              <input
                id="budget"
                className="budget-range"
                type="range"
                min={0}
                max={budgetStops.length - 1}
                step={1}
                value={budgetIndex(draft.budget)}
                aria-valuetext={money(draft.budget) + " maximum per outfit"}
                onChange={(e) =>
                  setDraft({ ...draft, budget: budgetStops[Number(e.target.value)] })
                }
              />
              <div className="range-labels">
                <span>$100</span>
                <span>$2,000</span>
              </div>
              <div className="quiz-summary">
                <CheckCircle2 size={17} />
                <p>
                  Your edit: {draft.season},{" "}
                  {draft.vibes.join(" + ").toLowerCase()}, and up to{" "}
                  {money(draft.budget)} per look.
                </p>
              </div>
            </>
          )}
          <div className="modal-actions">
            {step > 0 ? (
              <button
                className="text-link"
                onClick={() => setStep((s) => s - 1)}
              >
                <ArrowLeft size={16} /> Back
              </button>
            ) : (
              <span />
            )}
            <button
              className="primary"
              disabled={
                (step === 0 &&
                  (!draft.name.trim() || !draft.occasions.length)) ||
                (step === 2 && !draft.vibes.length)
              }
              onClick={() =>
                step === 3 ? finishProfile() : setStep((s) => s + 1)
              }
            >
              {step === 3 ? "Meet my style edit" : "Continue"}{" "}
              <ArrowRight size={16} />
            </button>
          </div>
        </Modal>
      )}
      {detail && (
        <Modal
          notice={toast}
          title="The outfit edit"
          onClose={() => setDetail(null)}
          wide
        >
          <div className="detail-grid">
            <Board look={detail} />
            <div className="detail-copy">
              <p className="eyebrow">{detail.occasion} / YOUR EDIT</p>
              <h2>{detail.title}</h2>
              <p>{detail.why}</p>
              <div className="detail-total">
                <span>New pieces</span>
                <strong>{money(total(detail))}</strong>
              </div>
              <div className="detail-buttons">
                <button className="primary" onClick={() => saveLook(detail)}>
                  <Heart size={16} />
                  {state.saved.some((x) => x.id === detail.id)
                    ? "Saved to lookbook"
                    : "Save this look"}
                </button>
                <button
                  className="secondary"
                  onClick={() => {
                    if(requireProfile())setPlanDate(today());
                  }}
                >
                  <CalendarDays size={16} /> Plan it
                </button>
              </div>
              <h3 className="pieces-heading">The pieces, considered.</h3>
              {detail.pieces.map((p) => (
                <div className="shop-row" key={p.id}>
                  <ProductImage piece={p} />
                  <div>
                    <small>{p.owned ? "ALREADY YOURS" : p.brand}</small>
                    <h4>{p.name}</h4>
                    <span>{p.owned ? "From your closet" : money(p.price)}</span>
                  </div>
                  {!p.owned && p.shopUrl.startsWith("https://") && (
                    <a
                      aria-label={"Shop " + p.name}
                      href={p.shopUrl}
                      target="_blank"
                      rel="noopener noreferrer sponsored"
                    >
                      <ArrowUpRight size={19} />
                    </a>
                  )}
                </div>
              ))}
              <p className="fine-print">
                Product prices and stock can change. Check the retailer before
                buying. Images show individual pieces, not a virtual fitting.
              </p>
            </div>
          </div>
        </Modal>
      )}
      <>
        <Modal open={adding}
          notice={toast}
          title="Add to your closet"
          onClose={() => setAdding(false)}
        >
          <ClosetImport readPhoto={readPhoto} onStatus={setUploadStatus} onMinimize={()=>setAdding(false)} remaining={Math.max(0,closetLimit(state.plan)-state.closet.length)} onSave={pieces=>{
            if(!requireProfile())return false;
            if(!canAddPieces(state.plan,state.closet.length,pieces.length)){setClosetPremium(false);setClosetFull(true);return false;}
            setState(s=>({...s,closet:[...pieces,...s.closet]}));setAdding(false);notify('Your cutouts are in your closet.');return true;
          }}/>
          <details><summary>Add a piece manually instead</summary>
          <h2>
            Something you <em>already love.</em>
          </h2>
          <label className="upload-box">
            {pieceImage ? (
              <img src={pieceImage} alt="Piece preview" />
            ) : (
              <>
                <Upload size={26} />
                <strong>
                  {uploading ? "Preparing photo…" : "Add a photo"}
                </strong>
                <span>JPG, PNG or WebP · up to 15 MB</span>
              </>
            )}
            <input
              type="file"
              accept="image/*"
              disabled={uploading}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setUploading(true);
                try {
                  setPieceImage(await readPhoto(f));
                } catch (e) {
                  notify((e as Error).message);
                } finally {
                  setUploading(false);
                }
              }}
            />
          </label>
          <label className="field">
            Piece name
            <input
              value={pieceName}
              onChange={(e) => setPieceName(e.target.value)}
              maxLength={100}
              placeholder="My favorite cream knit"
            />
          </label>
          <div className="fields-row">
            <label className="field">
              Category
              <select
                value={pieceRole}
                onChange={(e) => setPieceRole(e.target.value)}
              >
                {[
                  "top",
                  "bottom",
                  "dress",
                  "shoes",
                  "outerwear",
                  "bag",
                  "accessory",
                ].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
            <label className="field">
              Color
              <ColorSelect value={pieceColor} onChange={setPieceColor}/>
            </label>
          </div>
          <p className="fine-print">
            A photo is optional. Your images are saved in this browser.
          </p>
          <button
            className="primary full"
            disabled={uploading || !pieceName.trim()}
            onClick={addPiece}
          >
            Add to my closet <Plus size={16} />
          </button>
          </details>
        </Modal>
      </>
      {planDate && (
        <Modal
          notice={toast}
          title="Plan an outfit"
          onClose={() => setPlanDate(null)}
        >
          <h2>
            Make tomorrow <em>easier.</em>
          </h2>
          <label className="field">
            Choose a date
            <input
              type="date"
              value={planDate}
              onChange={(e) => setPlanDate(e.target.value || today())}
            />
          </label>
          <p className="muted small">
            Choose a saved look or one from your current edit.
          </p>
          <div className="plan-options">
            {[...(detail ? [detail] : []), ...state.saved, ...displayedLooks]
              .filter((l, i, a) => a.findIndex((x) => x.id === l.id) === i)
              .map((l) => (
                <button
                  key={l.id}
                  onClick={() => {
                    setState((s) => ({
                      ...s,
                      plans: { ...s.plans, [planDate]: l },
                    }));
                    setPlanDate(null);
                    notify("Outfit added to your planner");
                  }}
                >
                  <Board look={l} />
                  <span>
                    {l.title}
                    <small>{money(total(l))} in new pieces</small>
                  </span>
                  <Plus size={17} />
                </button>
              ))}
          </div>
        </Modal>
      )}
      {addingInspo && (
        <Modal
          notice={toast}
          title="Save inspiration"
          onClose={() => setAddingInspo(false)}
        >
          <h2>
            Save that <em>feeling.</em>
          </h2>
          <p className="muted">
            A screenshot, an outfit, a color combination. Keep it all together.
          </p>
          <label className="upload-box">
            {inspoImage ? (
              <img src={inspoImage} alt="Inspiration preview" />
            ) : (
              <>
                <ImagePlus size={28} />
                <strong>
                  {uploading ? "Preparing image…" : "Choose an image"}
                </strong>
                <span>JPG, PNG or WebP · up to 15 MB</span>
              </>
            )}
            <input
              type="file"
              accept="image/*"
              disabled={uploading}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setUploading(true);
                try {
                  setInspoImage(await readPhoto(f));
                } catch (e) {
                  notify((e as Error).message);
                } finally {
                  setUploading(false);
                }
              }}
            />
          </label>
          <label className="field">
            What caught your eye?
            <textarea
              value={inspoNote}
              onChange={(e) => setInspoNote(e.target.value)}
              maxLength={300}
              placeholder="The relaxed layers, the touch of burgundy…"
            />
          </label>
          <button
            className="primary full"
            disabled={!inspoImage || uploading}
            onClick={() => {
              setState((s) => ({
                ...s,
                inspiration: [
                  {
                    id: String(Date.now()),
                    image: inspoImage,
                    note: inspoNote,
                  },
                  ...s.inspiration,
                ],
              }));
              setAddingInspo(false);
              setInspoImage("");
              setInspoNote("");
              notify("Saved to your inspiration board");
            }}
          >
            Save inspiration <Bookmark size={16} />
          </button>
        </Modal>
      )}
      {info && (
        <Modal
          notice={toast}
          title="About this edition"
          onClose={() => setInfo(false)}
        >
          <h2>
            More style.
            <br />
            <em>Less friction.</em>
          </h2>
          <p>
            Atelier helps you discover outfits, make more of what you own, and
            plan your week. This independent Astra edition uses Atelier’s
            supplied catalog and imagery.
          </p>
          <h3>Your privacy</h3>
          <p>
            Your preferences and uploaded photos stay in this browser’s local
            storage. Clearing browser data removes them. There is no account,
            cloud sync, or payment processing in this edition.
          </p>
          <h3>Recommendations & shopping</h3>
          <p>
            Outfits use catalog matching based on your selected preferences and
            budget. Seasonal palettes are self-selected. Photo analysis and
            virtual try-on are not included. Retailer links open external sites
            with their own policies; catalog prices and availability may change.
          </p>
        </Modal>
      )}
    </div>
  );
}
