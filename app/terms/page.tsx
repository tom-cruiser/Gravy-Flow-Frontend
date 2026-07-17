import Link from 'next/link';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-brand-900 px-6 py-12 text-zinc-300">
      <div className="mx-auto max-w-3xl">
        <Link href="/register" className="mb-8 inline-block text-brand-300 hover:text-white">
          &larr; Back to registration
        </Link>
        
        <h1 className="mb-6 text-4xl font-bold tracking-tight text-white">Terms & Conditions</h1>
        <p className="mb-8 text-sm text-zinc-400">Last updated: July 17, 2026</p>

        <article className="prose prose-invert prose-zinc max-w-none">
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white">1. Acceptance of Terms</h2>
            <p>By creating an account on GravyFlow, you agree to be bound by these Terms. If you do not agree, please do not use our services.</p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white">2. Acceptable Use</h2>
            <p>You agree not to use the platform to host, distribute, or promote illegal content, malware, or spam. You are responsible for all activity that occurs under your account.</p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white">3. Limitation of Liability</h2>
            <p>GravyFlow is provided on an "as-is" basis. We are not liable for any data loss, service interruptions, or business damages resulting from your use of our infrastructure.</p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white">4. Data Ownership</h2>
            <p>You retain full ownership of the code and data you deploy to our platform. By hosting with us, you grant GravyFlow a limited license to store and process your data solely for the purpose of providing the service.</p>
          </section>
        </article>

        <div className="mt-12 border-t border-zinc-800 pt-8">
          <Link href="/register" className="gf-btn-primary block w-full text-center">
            I understand and agree
          </Link>
        </div>
      </div>
    </div>
  );
}