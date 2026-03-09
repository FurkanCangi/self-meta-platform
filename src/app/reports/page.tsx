"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Report = {
  id: string;
  version: number;
  created_at: string;
  report_text: string;
};

export default function ReportsPage() {

  const [reports,setReports] = useState<Report[]>([])
  const [loading,setLoading] = useState(true)
  const [error,setError] = useState<string | null>(null)

  useEffect(()=>{

    async function loadReports(){

      setLoading(true)
      setError(null)

      const {data,error} = await supabase
        .from("reports")
        .select("id, version, created_at, report_text")
        .order("created_at",{ascending:false})

      if(error){
        setError(error.message)
      }else{
        setReports(data || [])
      }

      setLoading(false)
    }

    loadReports()

  },[])

  return(

    <div className="space-y-6">

      <div className="selfmeta-card p-6">
        <h1 className="text-2xl font-semibold text-slate-900">
          Rapor Geçmişi
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Oluşturulan klinik raporlar burada görüntülenir.
        </p>
      </div>

      <div className="selfmeta-card p-6">

        {loading && (
          <div className="text-sm text-slate-500">
            Yükleniyor...
          </div>
        )}

        {error && (
          <div className="text-sm text-rose-600">
            Hata: {error}
          </div>
        )}

        {!loading && reports.length === 0 && (
          <div className="text-sm text-slate-500">
            Henüz rapor yok.
          </div>
        )}

        {!loading && reports.length > 0 && (

          <table className="w-full text-sm">

            <thead>
              <tr className="text-left border-b">
                <th className="py-2">Versiyon</th>
                <th className="py-2">Tarih</th>
                <th className="py-2">Rapor</th>
              </tr>
            </thead>

            <tbody>

              {reports.map(r=>(
                <tr key={r.id} className="border-b">

                  <td className="py-2">
                    v{r.version}
                  </td>

                  <td className="py-2">
                    {new Date(r.created_at).toLocaleString()}
                  </td>

                  <td className="py-2">
                    {r.report_text?.slice(0,120)}
                  </td>

                </tr>
              ))}

            </tbody>

          </table>

        )}

      </div>

    </div>

  )

}
