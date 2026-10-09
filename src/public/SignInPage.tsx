import { useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowLeft, ArrowUpRight, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { ProductBrand, OrganizationLogo } from './Brand'
import WorkspaceFinder from './WorkspaceFinder'
import type { Site } from './site'
import '@fontsource-variable/dm-sans'
import './public.css'
import './sign-in.css'

type Props = { site: Site; busy: boolean; error: string; emailEnabled: boolean; submit: (event: FormEvent<HTMLFormElement>) => void; recover: () => void; signup: () => void }
export default function SignInPage({ site, busy, error, emailEnabled, submit, recover, signup }: Props) {
  const [visible, setVisible] = useState(false)
  const organization = site.organization
  return <div className="public-site sign-in-site counter-sign-in">
    <a className="public-skip" href="#sign-in-email">Skip to sign in</a>
    <header className="public-header public-container"><ProductBrand href={site.platform_url} /><span className="login-header-label">THE STORE STARTS HERE</span><a className="public-text-link" href={site.platform_url}><ArrowLeft size={16} aria-hidden="true" />Ive POS home</a></header>
    <main className="sign-in-layout">
      <aside className="login-storefront" aria-label="Ive POS retail workspace">
        <div className="storefront-topline"><span>IVE POS / NEPAL</span><span>YOUR DAILY WORKSPACE</span></div>
        <div className="storefront-title" aria-hidden="true"><span>OPEN FOR</span><span>BUSINESS<span className="storefront-period">.</span></span></div>
        <div className="storefront-caption"><span>Same counter. Fresh start.</span><ArrowUpRight size={28} aria-hidden="true" /></div>
        <div className="login-product-stage"><div className="login-screen"><img src="/images/product/ive-pos-terminal.webp" width="2160" height="1800" alt="Ive POS terminal with product search and a cash bill, using sample store data" fetchPriority="high" decoding="async" /></div><span className="login-screen-label">THE TERMINAL / SAMPLE STORE DATA</span></div>
        <div className="storefront-bottom"><span>01 / CHECKOUT</span><span>02 / STOCK</span><span>03 / YOUR TEAM</span></div>
      </aside>
      <section className="login-counter" aria-labelledby="sign-in-title">
        <div className="receipt-slot" aria-hidden="true" />
        <div className="login-receipt">
          <div className="receipt-masthead"><span>IVE POS</span><span>WORKSPACE ENTRY <ArrowUpRight size={14} aria-hidden="true" /></span></div>
          <div className="sign-in-heading">{organization && <OrganizationLogo key={organization.image_url} organization={organization} />}<span className="receipt-eyebrow">{organization ? 'YOUR ORGANIZATION' : 'WELCOME BACK'}</span><h1 id="sign-in-title">{organization ? organization.name : 'Sign in to Ive POS'}</h1>{organization && <p className="sign-in-address">{new URL(organization.login_url).hostname}</p>}</div>
          <form className="public-auth-form" onSubmit={submit} aria-busy={busy}>
            <label htmlFor="sign-in-email"><span><i aria-hidden="true">01</i>Email address</span><input id="sign-in-email" name="email" type="email" autoComplete="username" placeholder="you@company.com" required maxLength={254} disabled={busy} /></label>
            <label htmlFor="sign-in-password"><span><i aria-hidden="true">02</i>Password</span><div className="password-field"><input id="sign-in-password" name="password" type={visible ? 'text' : 'password'} autoComplete="current-password" placeholder="Your password" required maxLength={128} disabled={busy} /><button type="button" disabled={busy} aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible} onClick={() => setVisible(value => !value)}>{visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}</button></div></label>
            <label htmlFor="sign-in-code"><span><i aria-hidden="true">03</i>MFA code <small>if enabled</small></span><input id="sign-in-code" name="code" autoComplete="one-time-code" placeholder="Authenticator or backup code" maxLength={64} spellCheck={false} autoCapitalize="none" disabled={busy} /></label>
            {error && <p role="alert" className="public-error">{error}</p>}
            <button className="public-button sign-in-submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}<ArrowUpRight size={20} aria-hidden="true" /></button>
          </form>
          <div className="sign-in-links">{emailEnabled && <button disabled={busy} onClick={recover}>Reset password</button>}{emailEnabled && !organization && <button disabled={busy} onClick={signup}>Create account</button>}</div>
          {organization ? <div className="sign-in-provider"><ShieldCheck size={16} aria-hidden="true" /><span>Secured by</span><img src="/ive-pos-logo.svg" width="80" height="24" alt="Ive POS" /></div> : <details className="sign-in-workspace"><summary>Use your organization’s address</summary><WorkspaceFinder baseDomain={site.tenant_base_domain || undefined} /></details>}
          <div className="receipt-tail" aria-hidden="true"><div className="receipt-barcode" /><span>YOUR STORE. YOUR NEXT WORKING DAY.</span></div>
        </div>
      </section>
    </main>
    <footer className="sign-in-footer public-container"><span>© {new Date().getFullYear()} Ive POS</span>{organization ? <a href={`${site.platform_url}/login`}>Platform sign-in<ArrowUpRight size={14} aria-hidden="true" /></a> : <span>MADE FOR THE EVERYDAY.</span>}</footer>
  </div>
}
