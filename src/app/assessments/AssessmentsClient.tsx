"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Scores = {
  s1: number
  s2: number
  s3: number
  s4: number
}

function calcRisk(total:number){

  if(total >= 12) return "Yüksek"
  if(total >= 8) return "Orta"
  if(total >= 4) return "Düşük"

  return "İzlem"
}

export default function AssessmentsClient(){

  const params = useSearchParams()

  const clientCode = params.get("client")
  const clientId = params.get("client_id")

  const [assessmentId,setAssessmentId] = useState<string | null>(null)
  const [creating,setCreating] = useState(false)

  const [scores,setScores] = useState<Scores>({
    s1:0,
    s2:0,
    s3:0,
    s4:0
  })

  const [saving,setSaving] = useState(false)
  const [msg,setMsg] = useState<string | null>(null)

  const total = scores.s1 + scores.s2 + scores.s3 + scores.s4
  const risk = calcRisk(total)

  useEffect(()=>{

    if(!clientId) return

    async function createAssessment(){

      setCreating(true)

      const {data,error} = await supabase
      .from("assessments_v2")
      .insert({
        client_id:clientId,
        label:"Klinik Değerlendirme",
        assessment_date:new Date().toISOString()
      })
      .select("id")
      .single()

      if(!error){
        setAssessmentId(data.id)
      }

      setCreating(false)
    }

    createAssessment()

  },[clientId])

  async function saveReport(){

    if(!assessmentId) return

    setSaving(true)

    const reportText = `
Danışan: ${clientCode}

Alt Boyutlar
1: ${scores.s1}
2: ${scores.s2}
3: ${scores.s3}
4: ${scores.s4}

Toplam Skor: ${total}
Risk Seviyesi: ${risk}
`

    const {error} = await supabase
    .from("reports")
    .insert({
      assessment_id:assessmentId,
      version:1,
      report_text:reportText,
      immutable:true,
      snapshot_json:{
        scores,
        total,
        risk
      }
    })

    if(!error){
      setMsg("Rapor oluşturuldu")
    }else{
      setMsg("Hata: "+error.message)
    }

    setSaving(false)
  }

  return(

    <div className="space-y-6">

      <div className="selfmeta-card p-5">
        <div className="text-xs text-slate-400">Klinik Değerlendirme</div>
        <h1 className="text-2xl font-semibold text-slate-900 mt-1">
          Skor Girişi
        </h1>

        <div className="mt-3 text-sm text-slate-500">
          Danışan: {clientCode} | Assessment: {assessmentId ?? "..."}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">

        <input
        type="number"
        value={scores.s1}
        onChange={e=>setScores({...scores,s1:Number(e.target.value)})}
        className="selfmeta-input p-3"
        placeholder="Alt Boyut 1"
        />

        <input
        type="number"
        value={scores.s2}
        onChange={e=>setScores({...scores,s2:Number(e.target.value)})}
        className="selfmeta-input p-3"
        placeholder="Alt Boyut 2"
        />

        <input
        type="number"
        value={scores.s3}
        onChange={e=>setScores({...scores,s3:Number(e.target.value)})}
        className="selfmeta-input p-3"
        placeholder="Alt Boyut 3"
        />

        <input
        type="number"
        value={scores.s4}
        onChange={e=>setScores({...scores,s4:Number(e.target.value)})}
        className="selfmeta-input p-3"
        placeholder="Alt Boyut 4"
        />

      </div>

      <div className="selfmeta-card p-5">

        <div className="text-sm text-slate-500">Toplam Skor</div>
        <div className="text-3xl font-semibold text-slate-900 mt-1">{total}</div>

        <div className="mt-4 text-sm text-slate-500">Risk</div>
        <div className="text-lg font-semibold mt-1">{risk}</div>

      </div>

      <button
      onClick={saveReport}
      disabled={saving || creating}
      className="selfmeta-btn px-6 py-3"
      >
        {saving ? "Kaydediliyor..." : "Rapor Oluştur"}
      </button>

      {msg && (
        <div className="text-sm text-slate-600">{msg}</div>
      )}

    </div>

  )
}
