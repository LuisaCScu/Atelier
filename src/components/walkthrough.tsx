"use client";
import { useState } from "react";
import { ArrowRight, Sparkles, Shirt, Heart, CalendarDays, Compass } from "lucide-react";

const steps = [
  { title: "Discover your kind of style", icon: Compass, text: "Find looks inspired by your colors and preferences. Like or pass on inspiration to help Atelier understand your taste." },
  { title: "Tell your stylist the occasion", icon: Sparkles, text: "Style a brand-new look or elevate looks from your closet. Choose an occasion and budget, then add a short note about what you have in mind." },
  { title: "Give your closet a fresh start", icon: Shirt, text: "Add clothing photos, select the pieces, then review their cutouts. You can explore while we work—just keep this browser tab open. Tap Style my closet to make outfits from what you own." },
  { title: "Keep the looks you love", icon: Heart, text: "Tap a look’s heart to keep it in your Lookbook. Return to your favorites whenever you need a little inspiration." },
  { title: "Make getting dressed easier", icon: CalendarDays, text: "Plan outfits for the days ahead, then return to your planner when it’s time to get dressed. Your week, a little more put together." },
];

export function Walkthrough({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(-1);
  const current = steps[Math.min(steps.length - 1, Math.max(0, step))];
  const Icon = current.icon;
  return <section className="atelier-tour">
    {step < 0 ? <>
      <div className="tour-welcome" aria-hidden="true">{steps.map(({icon: Symbol,title}) => <Symbol key={title} size={30} strokeWidth={1.3}/>)}</div>
      <h2>Welcome to <em>your Atelier.</em></h2>
      <p>Would you like a quick look around? Five little steps to help you make the most of your wardrobe.</p>
      <button className="primary full" onClick={() => setStep(0)}>Show me around <ArrowRight size={17}/></button>
      <button className="text-link" onClick={onClose}>Skip for now</button>
      <p className="fine-print">You can return anytime with “Take a tour” at the bottom of the app.</p>
    </> : step === steps.length ? <>
      <div className="tour-visual" aria-hidden="true"><Sparkles size={42} strokeWidth={1.2}/></div>
      <h2>Make it yours.<br/><em>Enjoy styling.</em></h2>
      <p>Atelier is always free to use. Upgrade to Premium for added closet room.</p>
      <button className="primary full" onClick={onClose}>Let’s get styling <ArrowRight size={17}/></button>
      <button className="text-link" onClick={() => setStep(steps.length - 1)}>Back</button>
    </> : <>
      <p className="eyebrow">YOUR QUICK TOUR · {step + 1} OF {steps.length}</p>
      <div className="tour-visual" aria-hidden="true">
        <Icon size={42} strokeWidth={1.2}/>
      </div>
      <div aria-live="polite"><h2>{current.title}</h2><p>{current.text}</p></div>
      <div className="tour-progress" aria-label={`Step ${step + 1} of ${steps.length}`}>{steps.map((item, i) => <button key={item.title} className={i===step ? "active" : ""} aria-label={`Step ${i+1}: ${item.title}`} aria-current={i===step ? "step" : undefined} onClick={()=>setStep(i)}/>)}</div>
      <div className="tour-actions"><button className="secondary" onClick={() => setStep(step-1)}>Back</button><button className="primary" onClick={() => setStep(step+1)}>{step === steps.length-1 ? "Finish tour" : "Next"}<ArrowRight size={17}/></button></div>
      <button className="text-link" onClick={onClose}>Skip tour</button>
    </>}
  </section>;
}
