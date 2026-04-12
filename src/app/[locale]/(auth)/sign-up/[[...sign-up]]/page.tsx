import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <SignUp
      appearance={{
        elements: {
          card: "bg-slate-900/50 backdrop-blur-xl border border-slate-800/50 shadow-2xl shadow-violet-500/5",
          headerTitle: "text-white",
          headerSubtitle: "text-slate-400",
          socialButtonsBlockButton:
            "bg-slate-800/50 border-slate-700 text-white hover:bg-slate-800",
          formFieldLabel: "text-slate-300",
          formFieldInput:
            "bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-violet-500 focus:ring-violet-500/20",
          formButtonPrimary:
            "bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 text-white",
          footerActionLink: "text-violet-400 hover:text-violet-300",
          identityPreviewEditButton: "text-violet-400",
        },
      }}
    />
  );
}
