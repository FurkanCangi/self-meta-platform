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
                    <td style={{padding: '24px 24px 0'}}>
                        <table cellPadding="0" cellSpacing="0" style={{border: 'none'}}>
                            <tbody>
                                <tr>
                                    <td style={{minWidth: '130px', paddingBottom: '8px'}}>Invoice No. :</td>
                                    <td style={{color: '#8492a6'}}>#land45845621</td>
                                </tr>
                                <tr>
                                    <td style={{minWidth: '130px', paddingBottom: '8px'}}>Name :</td>
                                    <td style={{color: '#8492a6'}}>Harry Patel</td>
                                </tr>
                                <tr>
                                    <td style={{minWidth: '130px', paddingBottom: '8px'}}>Address :</td>
                                    <td style={{color: '#8492a6'}}>1962 Pike Street, CA 92123</td>
                                </tr>
                                <tr>
                                    <td style={{minWidth: '130px', paddingBottom: '8px'}}>Date :</td>
                                    <td style={{color: '#8492a6'}}>March, 25 2021</td>
                                </tr>
                            </tbody>
                        </table>
                    </td>
                </tr>
                
                <tr>
                    <td style={{padding: '24px'}}>
                        <div style={{display: 'block', overflow: 'auto',  borderRadius: '6px', boxShadow: '0 0 3px rgba(60, 72, 88, 0.15)'}}>
                            <table cellPadding="0" cellSpacing="0">
                                <thead style={{backgroundColor:'#f8f9fc'}}>
                                    <tr>
                                        <th scope="col" style={{textAlign: 'left', verticalAlign: 'bottom', borderTop: '1px solid #dee2e6', padding: '12px'}}>No.</th>
                                        <th scope="col" style={{textAlign: 'left',  verticalAlign: 'bottom',  borderTop: '1px solid #dee2e6', padding: '12px', width: '200px'}}>Item</th>
                                        <th scope="col" style={{textAlign: 'end',  verticalAlign: 'bottom', borderTop: '1px solid #dee2e6', padding: '12px'}}>Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <th scope="row" style={{textAlign: 'left', padding: '12px', borderTop: '1px solid #dee2e6'}}>1</th>
                                        <td style={{textAlign: 'left', padding: '12px', borderTop: '1px solid #dee2e6'}}>Techwind Template</td>
                                        <td style={{textAlign: 'end', padding: '12px', borderTop: '1px solid #dee2e6'}}>$ 5200</td>
                                    </tr>
                                    <tr>
                                        <th scope="row" style={{textAlign: 'left', padding: '12px', borderTop: '1px solid #dee2e6'}}>2</th>
                                        <td style={{textAlign: 'left', padding: '12px', borderTop: '1px solid #dee2e6'}}>Customization</td>
                                        <td style={{textAlign: 'end', padding: '12px', borderTop: '1px solid #dee2e6'}}>$ 3660</td>
                                    </tr>
                                    <tr>
                                        <th scope="row" style={{textAlign: 'left', padding: '12px', borderTop: '1px solid #dee2e6'}}>3</th>
                                        <td style={{textAlign: 'left', padding: '12px', borderTop: '1px solid #dee2e6'}}>Development</td>
                                        <td style={{textAlign: 'end', padding: '12px', borderTop: '1px solid #dee2e6'}}>$ 13740</td>
                                    </tr>

                                    <tr style={{backgroundColor: 'rgba(77, 69, 230, 0.05)', color: '#4f46e5', overflow: 'hidden'}}>
                                        <th scope="row" style={{textAlign: 'left', padding: '12px', borderTop: '1px solid rgba(77, 69, 230, 0.05)'}}>Total</th>
                                        <td colSpan={2} style={{textAlign: 'end', fontWeight: '700', fontSize: '18px', padding: '12px',  borderTop: '1px solid rgba(77, 69, 230, 0.05)'}}>$ 22600</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
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