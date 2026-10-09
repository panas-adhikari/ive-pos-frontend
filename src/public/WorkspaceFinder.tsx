import { useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { tenantBaseDomain, workspaceUrl } from './site'

export default function WorkspaceFinder({ baseDomain = tenantBaseDomain }: { baseDomain?: string }) {
  const [error, setError] = useState('')
  function open(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const slug = String(new FormData(event.currentTarget).get('workspace') || '')
    try { window.location.assign(workspaceUrl(slug, baseDomain)) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Check your store address.') }
  }
  return <form className="workspace-finder" onSubmit={open}>
    <label htmlFor="workspace-address">Store address</label>
    <div className="workspace-address"><input id="workspace-address" name="workspace" placeholder="your-store" aria-describedby={error ? 'workspace-error' : undefined} autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={63} required /><span>.{baseDomain}</span><button type="submit" aria-label="Open store sign-in"><ArrowUpRight size={20} /></button></div>
    {error && <p id="workspace-error" role="alert" className="public-error">{error}</p>}
  </form>
}
