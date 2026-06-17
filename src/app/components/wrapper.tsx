"use client"
import React,{useState} from "react";
import Sidebar from "./sidebar";
import Topnav from "./topnav";

export default function Wrapper(props:any){
    let [toggle, setToggle] = useState(true)
    return(
    <div className={`page-wrapper dna-shell ${toggle ? "toggled" : ""}`}>
      <Sidebar toggle={toggle} setToggle={setToggle}/>
      <main className="page-content min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_46%,#f3f0ff_100%)]">
        <Topnav toggle={toggle} setToggle={setToggle}/>
        {props.children}
      </main>
    </div>
    )
}
