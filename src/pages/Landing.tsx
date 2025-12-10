import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Brain,
  Scale,
  TrendingUp,
  Eye,
  Trophy,
  CheckCircle,
  RefreshCw,
  BarChart3,
  Shield,
  Zap,
  FileText,
  Stethoscope,
  ArrowRight,
  Anchor,
  TrendingDown,
  Search,
  Coins,
  Sparkles,
  Quote,
} from "lucide-react";

const Landing = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <Brain className="h-8 w-8 text-primary" />
              <span className="font-bold text-xl tracking-tight">BiasLens</span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a href="#why-it-matters" className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium">
                Why It Matters
              </a>
              <a href="#how-it-works" className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium">
                How It Works
              </a>
              <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium">
                Features
              </a>
              <a href="#faq" className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium">
                FAQ
              </a>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" asChild>
                <Link to="/auth">Log In</Link>
              </Button>
              <Button asChild className="shadow-lg shadow-primary/20">
                <Link to="/auth">Start Testing Free</Link>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 md:pt-40 md:pb-28 relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5" />
        <div className="absolute top-20 right-0 w-[600px] h-[600px] bg-primary/10 rounded-full blur-3xl opacity-50" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-accent/10 rounded-full blur-3xl opacity-50" />
        
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Sparkles className="h-4 w-4" />
              <span>40+ test cases across 5 cognitive biases</span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-tight">
              Your LLM Is Smarter Than You Think.{" "}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                But Is It Biased?
              </span>
            </h1>
            
            <p className="text-lg sm:text-xl text-muted-foreground mb-8 max-w-3xl mx-auto leading-relaxed">
              Cognitive biases aren't just about representation—they're about decision quality. 
              Our diagnostic tool systematically identifies and measures the heuristic patterns 
              that affect your LLM's recommendations.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Button size="lg" asChild className="text-lg px-8 py-6 shadow-xl shadow-primary/25">
                <Link to="/auth">
                  Start Testing Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="text-lg px-8 py-6">
                <a href="#how-it-works">See How It Works</a>
              </Button>
            </div>
            
            {/* Trust badges */}
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-success" />
                <span>GDPR Compliant</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-success" />
                <span>AES-256 Encryption</span>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-success" />
                <span>Audit-Ready Reports</span>
              </div>
            </div>
          </div>
          
          {/* Hero Visual - Bias Types */}
          <div className="mt-16 max-w-5xl mx-auto">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              {[
                { icon: Anchor, name: "Anchoring", color: "text-chart-1 bg-chart-1/10" },
                { icon: TrendingDown, name: "Loss Aversion", color: "text-chart-2 bg-chart-2/10" },
                { icon: Search, name: "Confirmation", color: "text-chart-3 bg-chart-3/10" },
                { icon: Coins, name: "Sunk Cost", color: "text-chart-4 bg-chart-4/10" },
                { icon: Eye, name: "Availability", color: "text-chart-5 bg-chart-5/10" },
              ].map((bias) => (
                <div
                  key={bias.name}
                  className="flex flex-col items-center gap-3 p-4 rounded-xl bg-card border border-border hover:shadow-lg transition-shadow"
                >
                  <div className={`p-3 rounded-lg ${bias.color}`}>
                    <bias.icon className="h-6 w-6" />
                  </div>
                  <span className="text-sm font-medium text-center">{bias.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section id="why-it-matters" className="py-20 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Why Cognitive Biases in LLMs Are Silently Costing You
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Traditional fairness testing misses the bigger picture. Here's why cognitive bias testing matters.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {/* Card 1 */}
            <div className="bg-card rounded-xl p-6 border border-border hover:shadow-lg transition-all group">
              <div className="p-3 rounded-lg bg-primary/10 text-primary w-fit mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <Brain className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Demographic Fairness Isn't Enough</h3>
              <p className="text-muted-foreground mb-4 leading-relaxed">
                Traditional fairness testing checks if your LLM treats different demographic groups equally. 
                But it misses the bigger picture: Does your LLM make good decisions?
              </p>
              <div className="pt-4 border-t border-border">
                <p className="text-sm font-medium text-primary">
                  An LLM with demographic parity but high confirmation bias will generate biased recommendations for all users.
                </p>
              </div>
            </div>
            
            {/* Card 2 */}
            <div className="bg-card rounded-xl p-6 border border-border hover:shadow-lg transition-all group">
              <div className="p-3 rounded-lg bg-accent/10 text-accent w-fit mb-4 group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
                <Scale className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Regulations Are Shifting</h3>
              <p className="text-muted-foreground mb-4 leading-relaxed">
                The EU AI Act (Article 10) mandates that high-risk AI systems must undergo mandatory bias 
                examination. It requires examination of "biases likely to affect health, safety, or fundamental rights."
              </p>
              <div className="pt-4 border-t border-border">
                <p className="text-sm font-medium text-accent">
                  You need more than demographic fairness metrics to pass regulatory audits.
                </p>
              </div>
            </div>
            
            {/* Card 3 */}
            <div className="bg-card rounded-xl p-6 border border-border hover:shadow-lg transition-all group">
              <div className="p-3 rounded-lg bg-warning/10 text-warning w-fit mb-4 group-hover:bg-warning group-hover:text-warning-foreground transition-colors">
                <TrendingUp className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Biases Affect High-Stakes Decisions</h3>
              <p className="text-muted-foreground mb-4 leading-relaxed">
                Clinical bias: LLMs anchor on initial symptoms and miss diagnoses. Financial bias: Framing 
                effects lead to inconsistent strategies. HR bias: Confirmation bias affects hiring.
              </p>
              <div className="pt-4 border-t border-border">
                <p className="text-sm font-medium text-warning">
                  In regulated industries, these aren't just fairness issues—they're safety and compliance issues.
                </p>
              </div>
            </div>
            
            {/* Card 4 */}
            <div className="bg-card rounded-xl p-6 border border-border hover:shadow-lg transition-all group">
              <div className="p-3 rounded-lg bg-danger/10 text-danger w-fit mb-4 group-hover:bg-danger group-hover:text-danger-foreground transition-colors">
                <Eye className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Bias Is Invisible Until You Test For It</h3>
              <p className="text-muted-foreground mb-4 leading-relaxed">
                Your LLM might work perfectly on internal benchmarks and pass basic fairness checks. 
                But does it anchor on initial information? Seek confirming evidence? Display loss aversion?
              </p>
              <div className="pt-4 border-t border-border">
                <p className="text-sm font-medium text-danger">
                  Without cognitive bias testing, you don't know what you don't know.
                </p>
              </div>
            </div>
            
            {/* Card 5 */}
            <div className="bg-card rounded-xl p-6 border border-border hover:shadow-lg transition-all group md:col-span-2 lg:col-span-1">
              <div className="p-3 rounded-lg bg-success/10 text-success w-fit mb-4 group-hover:bg-success group-hover:text-success-foreground transition-colors">
                <Trophy className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Early Adopters Gain Competitive Advantage</h3>
              <p className="text-muted-foreground mb-4 leading-relaxed">
                Organizations that proactively test cognitive biases will pass future audits faster, 
                build customer trust, and catch risky deployments before they fail.
              </p>
              <div className="pt-4 border-t border-border">
                <p className="text-sm font-medium text-success">
                  The companies testing cognitive biases now will be ahead when regulations catch up.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section id="how-it-works" className="py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Cognitive Bias Testing Done Right
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              We measure decision-making quality, not just representation
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Column 1 */}
            <div className="text-center">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 w-20 h-20 flex items-center justify-center mx-auto mb-6">
                <Brain className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-4">Behavioral Psychology Foundation</h3>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Inspired by 60+ years of behavioral psychology research. We test for the same cognitive 
                biases that affect human decision-making.
              </p>
              <ul className="text-left space-y-2 text-sm">
                {[
                  "Anchoring Bias",
                  "Loss Aversion",
                  "Confirmation Bias",
                  "Sunk Cost Fallacy",
                  "Availability Heuristic",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6 p-3 rounded-lg bg-muted text-sm font-medium">
                5 core biases × 8-12 test cases each
              </div>
            </div>
            
            {/* Column 2 */}
            <div className="text-center">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-accent/10 to-accent/5 w-20 h-20 flex items-center justify-center mx-auto mb-6">
                <RefreshCw className="h-10 w-10 text-accent" />
              </div>
              <h3 className="text-xl font-semibold mb-4">Multiple Iterations for Stability</h3>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                LLMs are non-deterministic—the same prompt produces different responses. 
                We run each test 5+ times (user-configurable) for statistical confidence.
              </p>
              <ul className="text-left space-y-2 text-sm">
                {[
                  "Mean bias score",
                  "Standard deviation",
                  "95% confidence intervals",
                  "Consistency rating",
                  "Trend analysis",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6 p-3 rounded-lg bg-muted text-sm font-medium">
                Confidence intervals ensure defensible results
              </div>
            </div>
            
            {/* Column 3 */}
            <div className="text-center">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-success/10 to-success/5 w-20 h-20 flex items-center justify-center mx-auto mb-6">
                <BarChart3 className="h-10 w-10 text-success" />
              </div>
              <h3 className="text-xl font-semibold mb-4">Production-Ready Monitoring</h3>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Deploy once, monitor continuously. Don't just test before deployment—
                catch bias drift over time with automated evaluations.
              </p>
              <ul className="text-left space-y-2 text-sm">
                {[
                  "Automated evaluations",
                  "Configurable frequency",
                  "Alert thresholds",
                  "Trend dashboards",
                  "Audit-ready reports",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6 p-3 rounded-lg bg-muted text-sm font-medium">
                Catch model degradation before production
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Beyond Traditional Fairness Tools
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              See how cognitive bias testing differs from traditional approaches
            </p>
          </div>
          
          <div className="max-w-4xl mx-auto overflow-x-auto">
            <table className="w-full bg-card rounded-xl border border-border overflow-hidden">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left p-4 font-semibold">Feature</th>
                  <th className="text-center p-4 font-semibold text-muted-foreground">Traditional Tools</th>
                  <th className="text-center p-4 font-semibold text-primary">BiasLens</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[
                  { feature: "Focus", traditional: "Demographics", ours: "Decision Quality" },
                  { feature: "Test Type", traditional: "Static metrics", ours: "Behavioral scenarios" },
                  { feature: "What It Measures", traditional: "Representation", ours: "Reasoning patterns" },
                  { feature: "Built For", traditional: "Tabular ML", ours: "Generative AI" },
                  { feature: "Non-Determinism Handling", traditional: "No", ours: "Yes (multi-run)" },
                  { feature: "Regulatory Alignment", traditional: "Partial", ours: "Full (EU AI Act)" },
                  { feature: "Continuous Monitoring", traditional: "No", ours: "Yes" },
                  { feature: "Cognitive Bias Detection", traditional: "No", ours: "Yes" },
                ].map((row) => (
                  <tr key={row.feature} className="hover:bg-muted/30 transition-colors">
                    <td className="p-4 font-medium">{row.feature}</td>
                    <td className="p-4 text-center text-muted-foreground">{row.traditional}</td>
                    <td className="p-4 text-center font-medium text-primary">{row.ours}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="mt-12 max-w-3xl mx-auto text-center p-6 rounded-xl bg-gradient-to-r from-primary/10 via-background to-accent/10 border border-border">
            <p className="text-lg font-medium mb-2">
              Traditional fairness tools ask: <span className="text-muted-foreground">"Is this demographic group treated equally?"</span>
            </p>
            <p className="text-lg font-medium">
              We ask: <span className="text-primary">"Does this AI make good decisions?"</span>
            </p>
          </div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Trusted by Teams Building Responsible AI
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              See how early adopters are using cognitive bias testing
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {[
              {
                quote: "Before cognitive bias testing, we thought our LLM was just making demographic-fair recommendations. We discovered it had strong anchoring bias—relying too heavily on initial symptoms and missing alternative diagnoses. That's a patient safety issue.",
                role: "Chief Medical Officer",
                company: "Healthcare AI Company",
                icon: Stethoscope,
                color: "text-chart-1 bg-chart-1/10",
              },
              {
                quote: "Regulators asked us to prove we'd tested for fairness. Our demographic fairness metrics looked great. But when we tested for loss aversion and framing bias, we found our model recommended different strategies for identical market conditions.",
                role: "Head of Responsible AI",
                company: "Financial Services Firm",
                icon: TrendingUp,
                color: "text-chart-2 bg-chart-2/10",
              },
              {
                quote: "Confirmation bias is insidious. Our LLM was highlighting positive candidate attributes while downplaying red flags. Cognitive bias testing revealed it systematically overweighted first impressions. We fixed it before it affected hiring decisions.",
                role: "VP of Talent",
                company: "Tech Company",
                icon: Brain,
                color: "text-chart-3 bg-chart-3/10",
              },
              {
                quote: "The EU AI Act is coming. We knew we needed to test for biases, but demographic fairness alone wasn't going to cut it. Cognitive bias testing gives us the audit trail and defensible evidence we need.",
                role: "Chief Risk Officer",
                company: "Financial Institution",
                icon: Shield,
                color: "text-chart-4 bg-chart-4/10",
              },
            ].map((testimonial, index) => (
              <div
                key={index}
                className="bg-card rounded-xl p-6 border border-border relative"
              >
                <Quote className="absolute top-4 right-4 h-8 w-8 text-muted/30" />
                <div className={`p-2 rounded-lg w-fit mb-4 ${testimonial.color}`}>
                  <testimonial.icon className="h-5 w-5" />
                </div>
                <p className="text-muted-foreground mb-6 leading-relaxed italic">
                  "{testimonial.quote}"
                </p>
                <div className="border-t border-border pt-4">
                  <p className="font-semibold">{testimonial.role}</p>
                  <p className="text-sm text-muted-foreground">{testimonial.company}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Everything You Need to Get Started
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Built for teams that move fast
            </p>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              {
                icon: CheckCircle,
                title: "5 Cognitive Biases, 40+ Test Cases",
                description: "Anchoring, Loss Aversion, Confirmation, Sunk Cost, Availability Heuristic",
              },
              {
                icon: Zap,
                title: "Multi-Model Support",
                description: "Test GPT-4, Claude, Gemini, Llama, custom endpoints—all in one place",
              },
              {
                icon: RefreshCw,
                title: "Non-Determinism Handling",
                description: "Automatic multi-run testing with statistical confidence intervals",
              },
              {
                icon: BarChart3,
                title: "Continuous Monitoring",
                description: "Set-and-forget automation from hourly to monthly evaluations",
              },
              {
                icon: FileText,
                title: "Audit-Ready Reports",
                description: "Generated reports map to EU AI Act, NIST Framework, and regulatory requirements",
              },
              {
                icon: Stethoscope,
                title: "Industry-Specific Variants",
                description: "Healthcare, Finance, HR, Insurance test suites with domain expertise (Coming Soon)",
              },
            ].map((feature, index) => (
              <div
                key={index}
                className="bg-card rounded-xl p-6 border border-border hover:shadow-lg transition-all group"
              >
                <div className="p-3 rounded-lg bg-primary/10 text-primary w-fit mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/10" />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              See Cognitive Biases in Your Models. In Minutes.
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Start your free trial today. No credit card required. 5 free evaluations included.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Button size="lg" asChild className="text-lg px-8 py-6 shadow-xl shadow-primary/25">
                <Link to="/auth">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
            
            <p className="text-sm text-muted-foreground">
              30-day free trial with 5 evaluations. No credit card required. Cancel anytime.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Common Questions
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Everything you need to know about cognitive bias testing
            </p>
          </div>
          
          <div className="max-w-3xl mx-auto">
            <Accordion type="single" collapsible className="space-y-4">
              {[
                {
                  question: "What makes cognitive bias testing different from demographic fairness?",
                  answer: "Demographic fairness testing asks: 'Are different groups treated equally?' Cognitive bias testing asks: 'Does the AI make good decisions?' We test for reasoning patterns like anchoring, loss aversion, and confirmation bias that affect decision quality for everyone—regardless of demographics. These biases can cause harm even when demographic fairness metrics look perfect.",
                },
                {
                  question: "How long does an evaluation take?",
                  answer: "First evaluation: 15-25 minutes depending on configuration. Subsequent automated evaluations: 10-20 minutes. You can configure the number of test iterations (more iterations = more statistical confidence but longer runtime).",
                },
                {
                  question: "Which LLMs does this work with?",
                  answer: "We support OpenAI (GPT-4, GPT-3.5), Anthropic (Claude), Google (Gemini), Meta (Llama), and custom endpoints. You provide your API keys; we keep them encrypted with AES-256.",
                },
                {
                  question: "Is my data secure?",
                  answer: "API keys are encrypted with AES-256. Test data is processed securely and never logged permanently. We're GDPR-compliant and working toward SOC 2 Type II certification. Your prompts and responses are only used for the evaluation and not stored beyond the session.",
                },
                {
                  question: "Can I integrate this into my existing ML platform?",
                  answer: "Yes. We provide webhooks for CI/CD integration and APIs for programmatic access. Our framework works alongside responsible AI platforms like Arthur, Credo AI, and Fiddler to provide a complete picture of model behavior.",
                },
                {
                  question: "What's a 'test iteration'?",
                  answer: "Because LLMs are non-deterministic (same prompt can produce different responses), single-pass testing is unreliable. We run each test multiple times (default 5, configurable) and calculate mean scores, standard deviation, and 95% confidence intervals. This gives you statistically valid, defensible results.",
                },
                {
                  question: "Do you report on demographics too?",
                  answer: "Yes. We measure both cognitive biases AND fairness across protected attributes. You get a complete picture of decision quality and representation—the full spectrum of responsible AI testing.",
                },
              ].map((faq, index) => (
                <AccordionItem
                  key={index}
                  value={`item-${index}`}
                  className="bg-card rounded-xl border border-border px-6"
                >
                  <AccordionTrigger className="hover:no-underline text-left font-semibold">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground leading-relaxed">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
          
          <div className="text-center mt-12">
            <p className="text-muted-foreground mb-4">
              Still have questions?
            </p>
            <Button variant="outline" asChild>
              <a href="mailto:support@biaslens.dev">Contact Support</a>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <Brain className="h-6 w-6 text-primary" />
                <span className="font-bold text-lg">BiasLens</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Cognitive bias testing for LLMs. Built for teams that care about decision quality.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#how-it-works" className="hover:text-foreground transition-colors">How It Works</a></li>
                <li><a href="#features" className="hover:text-foreground transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Case Studies</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Resources</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">API Reference</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Blog</a></li>
                <li><a href="#faq" className="hover:text-foreground transition-colors">FAQ</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Terms of Service</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Data Processing</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-border pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} BiasLens. All rights reserved.
            </p>
            <Button asChild size="sm">
              <Link to="/auth">Sign Up Free</Link>
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
