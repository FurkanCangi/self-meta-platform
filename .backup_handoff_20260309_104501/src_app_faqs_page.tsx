import React from "react";

import Footer from "../components/footer";
import Switcher from "../components/switcher";
import Wrapper from "../components/wrapper";
import Accordion from "../components/accordian";

export default function Page() {
  return (
    <Wrapper>
         <div className="container-fluid relative px-3">
            <div className="layout-specing">
                <Accordion/>
            </div>
        </div>
        <Footer/>
        <Switcher/>
    </Wrapper>
   
  )
}
