"use client"
import React from "react";

export default function Page(){
    return(
    <div style={{marginTop: '50px'}}>
        <table cellPadding="0" cellSpacing="0" style={{fontFamily:"Nunito, sans-serif" , fontSize:'15px', fontWeight:"400", maxWidth:'600px', border:"none", margin:'0 auto', borderRadius:'6px', overflow:"hidden", backgroundColor:'#fff', boxShadow:'0 0 3px rgba(60, 72, 88, 0.15)' }}>
            <thead>
                <tr style={{backgroundColor: '#4f46e5', padding: '3px 0', border: 'none', height: '68px', textAlign: 'center', color: '#fff', fontSize:' 24px', letterSpacing: '1px'}}>
                    <th scope="col" style={{height:'68px', display:'flex', justifyContent:'center', alignItems:'center'}}><img src='/images/logo-light.png' alt="" style={{margin:'0, auto'}}/></th>
                </tr>
            </thead>

            <tbody>
                <tr>
                    <td style={{padding: '24px 24px'}}>
                        <div style={{padding: '8px', color: '#dc2626', backgroundColor: 'rgba(219, 38, 38, 0.05)', border: '1px solid rgba(219, 38, 38, 0.05)', borderRadius: '6px',textAlign: 'center', fontSize: '16px', fontWeight: '600'}}>
                            Warning: Youre approaching your limit. Please upgrade.
                        </div>
                    </td>
                </tr>
                <tr>
                    <td style={{padding: '0 24px 15px', color: '#8492a6'}}>
                        <div>
                            You have <span style={{color: "#fff", backgroundColor: '#dc2626', padding: '4px 8px', borderRadius: '6px'}}>1 free report</span> remaining.
                        </div>
                    </td>
                </tr>
                <tr>
                    <td style={{padding: '0 24px 15px', color: '#8492a6'}}>
                        Add your credit card / debit card now to upgrade your account to a premium plan to ensure you dont miss out on any reports.
                    </td>
                </tr>

                <tr>
                    <td style={{padding: '15px 24px'}}>
                        <a href="" style={{padding: '8px 20px', outline: 'none', textDecoration: 'none', fontSize: "16px", letterSpacing: '0.5px', transition: 'all 0.3s', fontWeight: '600', borderRadius: '6px', backgroundColor: '#4f46e5', border: '1px solid #4f46e5', color: '#ffffff'}}>Upgrade Account</a>
                    </td>
                </tr>

                <tr>
                    <td style={{padding: '15px 24px 0', color: '#8492a6'}}>
                        Thanks for choosing Techwind Template.
                    </td>
                </tr>

                <tr>
                    <td style={{padding: '15px 24px 15px', color: '#8492a6',}}>
                        Techwind <br/> Support Team
                    </td>
                </tr>

                <tr>
                    <td style={{padding: '16px 8px', color: '#8492a6', backgroundColor: '#f8f9fc', textAlign: 'center'}}>
                        © {new Date().getFullYear()} Techwind.
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
    )
}