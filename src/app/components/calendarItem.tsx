// @ts-nocheck 
'use client'
import React from "react"

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";

export default function CalendarItem(){
    const events = [{date:'2023-09-16T13:00:00', title:'Business Lunch'}];
    return(
        <div id="calendar-container" className="rounded-md shadow-sm dark:shadow-gray-700 p-6 bg-white dark:bg-slate-900">
            <FullCalendar
                defaultView="dayGridMonth"
                plugins={[dayGridPlugin]}
                events={events}
                headerToolbar = {
                    {
                        left:'prev,next today addEventButton',
                        center:'title',
                        right :'dayGridMonth,dayGridWeek,dayGridDay'  
                    }
                }
                customButtons={
                {
                    addEventButton : {
                        text:'Add Event',
                        click : function (){
                            var dateStr = prompt('Enter a date in YYYY-MM-DD format');
                        }
                    }
                }
                }
            />
        </div>
    )
}
