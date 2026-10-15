"use client"

import { useCallback, useEffect, useState } from "react"

type Options<T extends { id: string | number }, F> = {
  listUrl: string
  collectionUrl: string
  itemUrl: (id: T["id"]) => string
  emptyForm: F
  toForm: (item: T) => F
  validate: (form: F) => string | null
}

export function useAdminCrud<T extends { id: string | number }, F>({
  listUrl, collectionUrl, itemUrl, emptyForm, toForm, validate,
}: Options<T, F>) {
  const [items, setItems]               = useState<T[]>([])
  const [loading, setLoading]           = useState(true)
  const [editing, setEditing]           = useState<T | null>(null)
  const [creating, setCreating]         = useState(false)
  const [form, setForm]                 = useState<F>(emptyForm)
  const [deleteTarget, setDeleteTarget] = useState<T | null>(null)
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(listUrl)
    if (res.ok) setItems(await res.json())
    setLoading(false)
  }, [listUrl])

  useEffect(() => { load() }, [load])

  function startCreate() {
    setForm(emptyForm)
    setEditing(null)
    setCreating(true)
    setError("")
  }

  function startEdit(item: T) {
    setForm(toForm(item))
    setEditing(item)
    setCreating(false)
    setError("")
  }

  function cancelForm() {
    setCreating(false)
    setEditing(null)
    setForm(emptyForm)
    setError("")
  }

  async function saveForm() {
    const invalid = validate(form)
    if (invalid) { setError(invalid); return }
    setSaving(true)
    setError("")
    try {
      const init = {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }
      const res = await fetch(editing ? itemUrl(editing.id) : collectionUrl, init)
      if (!res.ok) { setError(await res.text()); return }
      await load()
      cancelForm()
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    await fetch(itemUrl(deleteTarget.id), { method: "DELETE" })
    setDeleteTarget(null)
    await load()
  }

  return {
    items, loading, editing, creating, form, setForm,
    deleteTarget, setDeleteTarget, saving, error,
    startCreate, startEdit, cancelForm, saveForm, confirmDelete,
  }
}
