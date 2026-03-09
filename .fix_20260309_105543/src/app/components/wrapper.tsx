"use client"
import React,{useState} from "react";
import Sidebar from "./sidebar";
import Topnav from "./topnav";

export default function Wrapper(props:any){
    let [toggle, setToggle] = useState(true)
    return(
    <div className={`page-wrapper  ${toggle ? "toggled" : ""}`}>
      <Sidebar/>
      <main className="page-content bg-gray-50 dark:bg-slate-800">
        <Topnav toggle={toggle} setToggle={setToggle}/>
        {props.children}
      </main>
    </div>
    )
}