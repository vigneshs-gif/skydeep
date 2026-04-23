import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { Plane } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const authSearchSchema = z.object({
  mode: z.enum(["signin", "signup"]).optional().default("signin"),
  redirect: z.string().optional(),
});

const emailAddressSchema = z.string().trim().email("Invalid email").max(255);
const fullNameSchema = z.string().trim().min(1, "Name required").max(100);
const passwordSchema = z.string().min(6, "At least 6 characters").max(72);

export const Route = createFileRoute("/auth")({
  validateSearch: authSearchSchema,
  head: () => ({
    meta: [
      { title: "Sign in — skydeep" },
      { name: "description", content: "Sign in or create your skydeep account." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { mode, redirect } = Route.useSearch();
  const navigate = useNavigate();
  const { signIn, signUp, user } = useAuth();
  const [tab, setTab] = useState<"signin" | "signup">(mode);

  useEffect(() => {
    if (user) {
      navigate({ to: redirect ?? "/" });
    }
  }, [navigate, redirect, user]);

  return (
    <div className="min-h-[calc(100vh-4rem)] grid lg:grid-cols-2">
      <div className="hidden lg:flex bg-hero-gradient text-white p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-1/3 -left-20 h-72 w-72 rounded-full bg-sky-glow/40 blur-3xl animate-drift" />
        </div>
        <Link to="/" className="relative flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
            <Plane className="h-4 w-4 -rotate-45" />
          </div>
          <span className="font-display text-lg font-bold">skydeep</span>
        </Link>
        <div className="relative">
          <h2 className="font-display text-4xl font-bold leading-tight max-w-md">
            Your flight, <span className="text-gradient-sky">live</span> from booking to landing.
          </h2>
          <p className="mt-4 text-white/70 max-w-md">
            Sign in with your email and password to book faster.
          </p>
        </div>
        <div className="relative text-xs text-white/50 uppercase tracking-[0.2em]">
          skydeep secure access
        </div>
      </div>

      <div className="flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md">
          <Tabs value={tab} onValueChange={(value) => setTab(value as "signin" | "signup")}>
            <TabsList className="grid grid-cols-2 w-full mb-6">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Sign up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <SignInForm onSuccess={() => navigate({ to: redirect ?? "/" })} signIn={signIn} />
            </TabsContent>

            <TabsContent value="signup">
              <SignUpForm onSuccess={() => navigate({ to: redirect ?? "/" })} signUp={signUp} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

const signInSchema = z.object({
  email: emailAddressSchema,
  password: passwordSchema,
});

function SignInForm({
  onSuccess,
  signIn,
}: {
  onSuccess: () => void;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = signInSchema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    setLoading(true);
    const { error } = await signIn(parsed.data.email, parsed.data.password);
    setLoading(false);

    if (error) {
      toast.error(getFriendlyAuthErrorMessage(error));
      return;
    }

    toast.success("Welcome back!");
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-bold">Welcome back</h1>
        <p className="text-sm text-muted-foreground">Use your email and password to sign in.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="signin-email">Email</Label>
        <Input
          id="signin-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
          maxLength={255}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signin-password">Password</Label>
        <Input
          id="signin-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          minLength={6}
          maxLength={72}
        />
      </div>
      <Button type="submit" className="w-full shadow-sky" disabled={loading}>
        {loading ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}

const signUpSchema = z.object({
  fullName: fullNameSchema,
  email: emailAddressSchema,
  password: passwordSchema,
});

function SignUpForm({
  onSuccess,
  signUp,
}: {
  onSuccess: () => void;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = signUpSchema.safeParse({ fullName, email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    setLoading(true);
    const { error } = await signUp(parsed.data.email, parsed.data.password, parsed.data.fullName);
    setLoading(false);

    if (error) {
      toast.error(getFriendlyAuthErrorMessage(error));
      return;
    }

    toast.success("Account created — welcome aboard!");
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-bold">Create your account</h1>
        <p className="text-sm text-muted-foreground">
          Use a password if you prefer the classic flow.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-name">Full name</Label>
        <Input
          id="signup-name"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          placeholder="Jane Doe"
          required
          maxLength={100}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-email">Email</Label>
        <Input
          id="signup-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
          maxLength={255}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-password">Password</Label>
        <Input
          id="signup-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          minLength={6}
          maxLength={72}
        />
      </div>
      <Button type="submit" className="w-full shadow-sky" disabled={loading}>
        {loading ? "Creating account..." : "Create account"}
      </Button>
    </form>
  );
}

function getFriendlyAuthErrorMessage(error: Error) {
  const message = error.message.toLowerCase();

  if (message.includes("user already registered")) {
    return "This account already exists. Try signing in instead.";
  }

  return error.message;
}
