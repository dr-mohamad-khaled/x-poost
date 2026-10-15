/** Admin styles for the Bundle Builder pages (dark admin, gold-to-brown palette). */
export const BB_CSS = `
.bb-wrap{display:flex;flex-direction:column;gap:16px;padding:16px 8px 64px;color:#fff}
.bb-card{background:#150E07;border:1px solid #3A2B17;border-radius:12px;padding:20px;color:#fff;box-shadow:0 4px 20px rgba(0,0,0,.25)}
.bb-title{font-size:16px;font-weight:800;color:#E8C872;margin:0 0 14px;padding-bottom:10px;border-bottom:1px solid #3A2B17;display:flex;align-items:center;gap:10px}
.bb-title .n{width:24px;height:24px;border-radius:50%;background:linear-gradient(135deg,#FFEB97 0%,#E8C872 48%,#B8863B 100%);color:#111;font-size:12px;display:grid;place-items:center;flex-shrink:0}
.bb-title.nb{border:0;margin:0;padding:0}
.bb-desc{margin:-6px 0 14px;color:#D2C8AC;font-size:13px;line-height:1.55}
.bb-hero{display:flex;justify-content:space-between;gap:20px;align-items:center;background:linear-gradient(135deg,#1E140A,#120B05);border-color:#4D3B22}
.bb-hero h2{margin:0 0 6px;font-size:20px;color:#FFEB97}
.bb-hero p{margin:0;color:#D8CFB5;max-width:780px;line-height:1.55;font-size:14px}
.bb-muted{color:#D2C8AC}.bb-muted.sm,.bb-sm{font-size:12px}
.bb-banner{padding:10px 14px;border-radius:8px;font-size:13px;line-height:1.5}.bb-banner.ok{background:#12301c;border:1px solid #1e5a31;color:#bff0cd}.bb-banner.bad{background:#35171a;border:1px solid #6d2a31;color:#ffd0d3}.bb-banner.warn{background:#33250c;border:1px solid #6b4e17;color:#ffe2a6}
.bb-banner ul{margin:6px 0 0;padding-left:18px}
.bb-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;border-radius:8px;padding:9px 16px;font-weight:700;font-size:13px;cursor:pointer;text-decoration:none;border:1px solid #E8C872;background:#0C0803;color:#FFEB97;font-family:inherit}
.bb-btn.gold{background:linear-gradient(135deg,#FFEB97 0%,#E8C872 48%,#B8863B 100%);color:#111;border-color:#E8C872}
.bb-btn.ghost{background:transparent;border-color:#4D3B22;color:#F1EAD6}.bb-btn.sm{padding:5px 10px;font-size:12px}.bb-btn.danger{color:#ffb3b9;border-color:#5a2f34}
.bb-btn:disabled{cursor:not-allowed;background:#1D150C;border-color:#3A2B17;color:#9E957B}
.bb-icon{background:transparent;border:1px solid #4D3B22;color:#F1EAD6;border-radius:6px;width:28px;height:28px;cursor:pointer;line-height:1;font-size:13px}
.bb-icon:disabled{color:#7F7863;border-color:#2F2314;cursor:not-allowed}.bb-icon.danger{color:#ffb3b9}
.bb-row{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
.bb-switch{display:inline-flex;align-items:center;gap:8px;cursor:pointer;position:relative;font-weight:700;font-size:13px}
.bb-switch input{position:absolute;opacity:0;width:0;height:0}
.bb-switch .knob{width:42px;height:24px;border-radius:999px;background:#4a4a4a;position:relative;transition:.15s;flex-shrink:0}
.bb-switch .knob:after{content:"";position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;transition:.15s}
.bb-switch input:checked + .knob{background:#E8C872}.bb-switch input:checked + .knob:after{left:21px;background:#111}
.bb-switch.sm .knob{width:34px;height:20px}.bb-switch.sm .knob:after{width:14px;height:14px}.bb-switch.sm input:checked + .knob:after{left:17px}
.bb-switch input:focus-visible + .knob{outline:2px solid #FFEB97}
.bb-steps{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:8px;color:#E4DCC4;line-height:1.55;font-size:14px}
.bb-steps a{color:#FFEB97}
.bb-empty{padding:14px;border:1px dashed #4D3B22;border-radius:8px;color:#D8CFB5;font-size:13px;line-height:1.5}.bb-empty a{color:#FFEB97}
.bb-table-wrap{overflow-x:auto}
.bb-table{width:100%;border-collapse:collapse;font-size:13px;min-width:880px}
.bb-table th{text-align:left;color:#D2C8AC;font-weight:600;font-size:12px;padding:8px;border-bottom:1px solid #3A2B17}
.bb-table td{padding:10px 8px;border-bottom:1px solid #261C10;vertical-align:middle}
.bb-table .r{text-align:right}.bb-table .act{white-space:nowrap;display:flex;gap:6px;align-items:center;justify-content:flex-end}
.bb-name{color:#fff;font-weight:700;text-decoration:none}.bb-name:hover{color:#FFEB97}
.bb-pill{display:inline-block;font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;background:#2A1E10;color:#FFEB97;border:1px solid #4D3B22;margin-right:4px}
.bb-tpl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}
.bb-tpl{display:flex;flex-direction:column;gap:6px;padding:14px;border:1px solid #3A2B17;border-radius:10px;background:#0E0904;text-decoration:none;color:#fff;transition:border-color .15s}
.bb-tpl:hover{border-color:#E8C872}
.bb-tpl-kind{font-size:11px;letter-spacing:.06em;color:#E8C872;font-weight:700;text-transform:uppercase}.bb-tpl-name{font-weight:800;font-size:14px}.bb-tpl-tag{color:#D8CFB5;font-size:13px;line-height:1.45}
.bb-topbar{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;position:sticky;top:48px;z-index:20;background:#0C0803;padding:10px 0;border-bottom:1px solid #2A1E10}
.bb-topbar-r{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.bb-flash{font-size:12px;color:#D8CFB5}.bb-flash.ok{color:#8fe3a6}.bb-flash.bad{color:#ffb3b9}
.bb-layout{display:grid;grid-template-columns:minmax(0,1fr) 460px;gap:16px;align-items:start}
@media(max-width:1180px){.bb-layout{grid-template-columns:1fr}.bb-sticky{position:static!important}}
.bb-main{display:flex;flex-direction:column;gap:16px;min-width:0}
.bb-sticky{position:sticky;top:116px;display:flex;flex-direction:column;gap:12px}
.bb-field{display:flex;flex-direction:column;gap:6px;margin-bottom:12px}
.bb-field > label,.bb-label{font-size:13px;font-weight:600;color:#fff}
.bb-field > label{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}
.bb-field small,.bb-hint{font-size:12px;color:#D2C8AC;line-height:1.5}
.bb-input{box-sizing:border-box;padding:8px 12px;border:1px solid #4D3B22;border-radius:6px;font-size:13px;background:#0E0904;color:#fff;width:100%;font-family:inherit}
.bb-input::placeholder{color:#A39A80}.bb-input[type=date]{color-scheme:dark}.bb-wrap input[type=range]{accent-color:#E8C872}
.bb-input.sm{width:auto;min-width:90px}.bb-input.xs{width:76px}.bb-input:focus{outline:2px solid #E8C87288;border-color:#E8C872}
textarea.bb-input{resize:vertical;font-family:ui-monospace,Menlo,monospace;font-size:12px}
.bb-grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}.bb-grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.bb-grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
@media(max-width:760px){.bb-grid2,.bb-grid3,.bb-grid4{grid-template-columns:1fr 1fr}}
.bb-check{display:flex;align-items:flex-start;gap:8px;font-size:13px;color:#F1EAD6;cursor:pointer;line-height:1.45;margin-bottom:8px}
.bb-check input{margin-top:2px;accent-color:#E8C872}
.bb-check small{display:block;color:#D2C8AC;font-size:12px}
.bb-seg{display:inline-flex;border:1px solid #4D3B22;border-radius:8px;overflow:hidden;flex-wrap:wrap}
.bb-seg button{background:#0E0904;color:#E4DCC4;border:0;border-right:1px solid #2F2314;padding:8px 14px;font-size:13px;cursor:pointer;font-weight:600;font-family:inherit}
.bb-seg button:last-child{border-right:0}
.bb-seg button.on{background:linear-gradient(135deg,#FFEB97 0%,#E8C872 48%,#B8863B 100%);color:#111}.bb-seg.sm button{padding:5px 10px;font-size:12px}
.bb-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px}
.bb-choice{display:flex;flex-direction:column;gap:6px;text-align:left;padding:14px;border:1px solid #3A2B17;border-radius:10px;background:#0E0904;color:#fff;cursor:pointer;font-family:inherit}
.bb-choice b{font-size:14px}.bb-choice span{font-size:12px;color:#D8CFB5;line-height:1.5}
.bb-choice.on{border-color:#E8C872;background:#1D150C;box-shadow:0 0 0 1px #E8C872}
.bb-choice:disabled{cursor:not-allowed;border-style:dashed}
.bb-design-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px}
.bb-design{display:flex;flex-direction:column;gap:6px;text-align:left;padding:10px;border:1px solid #3A2B17;border-radius:10px;background:#0E0904;color:#fff;cursor:pointer;font-family:inherit}
.bb-design.on{border-color:#E8C872;background:#1D150C;box-shadow:0 0 0 1px #E8C872}
.bb-design-name{font-weight:800;font-size:13px}.bb-design-blurb{font-size:12px;color:#D8CFB5;line-height:1.45}
.bb-design svg{width:100%;height:auto;border-radius:6px;background:#F5F3EE}
.bb-box{border:1px solid #3A2B17;border-radius:10px;padding:14px;background:#0E0904;margin-bottom:12px}
.bb-box-h{display:flex;align-items:center;gap:8px;margin-bottom:10px}
.bb-box-h .n{width:22px;height:22px;border-radius:50%;background:linear-gradient(135deg,#FFEB97 0%,#E8C872 48%,#B8863B 100%);color:#111;font-weight:800;font-size:12px;display:grid;place-items:center;flex-shrink:0}
.bb-inline{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.bb-picker{display:flex;flex-direction:column;gap:8px}
.bb-chosen{display:flex;flex-direction:column;gap:6px}
.bb-chosen-row{display:flex;gap:10px;align-items:center;border:1px solid #2F2314;border-radius:8px;padding:6px 8px;background:#120C06}
.bb-chosen-row img,.bb-chosen-row .ph,.bb-result img,.bb-result .ph{width:36px;height:36px;border-radius:6px;object-fit:cover;background:#2A1E10;flex-shrink:0}
.bb-chosen-row .ttl{flex:1;min-width:0;font-size:13px;color:#fff}.bb-chosen-row small{color:#D2C8AC}
.bb-results{border:1px solid #3A2B17;border-radius:8px;overflow:hidden;max-height:260px;overflow-y:auto}
.bb-result{display:flex;gap:10px;align-items:center;width:100%;padding:6px 10px;background:#0E0904;border:0;border-bottom:1px solid #241A0E;color:#fff;cursor:pointer;text-align:left;font-size:13px;font-family:inherit}
.bb-result:hover:not(:disabled){background:#1D150C}.bb-result:disabled{cursor:not-allowed;color:#9E957B}.bb-result span{flex:1}.bb-result small{color:#D2C8AC}
.pad{padding:10px}
.bb-chips{display:flex;flex-wrap:wrap;gap:6px}.bb-chip{display:inline-flex;gap:6px;align-items:center;background:#1D150C;border:1px solid #4D3B22;color:#FFEB97;border-radius:999px;padding:3px 6px 3px 10px;font-size:12px}
.bb-chip button{background:transparent;border:0;color:#FFEB97;cursor:pointer;font-size:13px}
.bb-conds{display:flex;flex-direction:column;gap:10px}
.bb-match{display:flex;align-items:center;gap:10px;font-size:13px;flex-wrap:wrap;color:#F1EAD6}
.bb-rule{border:1px solid #3A2B17;border-radius:10px;background:#0E0904;padding:10px;display:flex;flex-direction:column;gap:8px}
.bb-rule-head{display:flex;gap:8px;align-items:center}
.bb-rule-n{width:22px;height:22px;border-radius:50%;background:linear-gradient(135deg,#FFEB97 0%,#E8C872 48%,#B8863B 100%);color:#111;font-weight:800;font-size:12px;display:grid;place-items:center;flex-shrink:0}
.bb-langs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}
.bb-lang{background:#0E0904;border:1px solid #3A2B17;color:#E4DCC4;border-radius:999px;padding:6px 14px;cursor:pointer;font-size:13px;font-family:inherit}
.bb-lang.on{background:linear-gradient(135deg,#FFEB97 0%,#E8C872 48%,#B8863B 100%);color:#111;border-color:#E8C872;font-weight:700}
.bb-lang .dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:#7bd88f;margin-left:6px;vertical-align:middle}
.bb-colors{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.bb-color{display:flex;align-items:center;gap:8px;border:1px solid #3A2B17;border-radius:8px;padding:6px 8px;background:#0E0904}
.bb-color input[type=color]{width:30px;height:30px;border:0;background:none;padding:0;cursor:pointer}
.bb-color span{font-size:12px;color:#F1EAD6;line-height:1.3}.bb-color code{font-size:11px;color:#D2C8AC}
.bb-prev{background:#150E07;border:1px solid #3A2B17;border-radius:12px;padding:12px}
.bb-prev-bar{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px}
.bb-stage{background:#EDEBE6;border-radius:10px;overflow:hidden;margin:0 auto}
.bb-stage iframe{width:100%;border:0;display:block;background:#EDEBE6}
.bb-idbox{display:flex;align-items:center;gap:8px;background:#0E0904;border:1px solid #3A2B17;border-radius:8px;padding:8px 10px;font-size:12px;color:#D2C8AC}
.bb-idbox code{color:#FFEB97;font-size:12px;flex:1;overflow:hidden;text-overflow:ellipsis}
.bb-tiers{display:flex;flex-direction:column;gap:8px}
.bb-tier{display:flex;gap:8px;align-items:center;flex-wrap:wrap;border:1px solid #3A2B17;border-radius:8px;padding:8px 10px;background:#0E0904;font-size:13px;color:#F1EAD6}
.bb-details summary{cursor:pointer;color:#FFEB97;font-size:13px;font-weight:700;margin:6px 0 10px}
.bb-stat{font-variant-numeric:tabular-nums}
.bb-tip{display:flex;gap:10px;font-size:13px;line-height:1.5;color:#E4DCC4;margin:0 0 8px}
.bb-tip i{font-style:normal;width:20px;height:20px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:800;flex-shrink:0;background:#2A1E10;color:#E8C872}
.bb-stat-box{background:#0E0904;border:1px solid #3A2B17;border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:4px}
.bb-stat-box span{font-size:12px;color:#D2C8AC}.bb-stat-box b{font-size:20px;color:#fff;font-variant-numeric:tabular-nums}
.bb-sub{border:1px dashed #4A3720;border-radius:10px;padding:12px;margin-top:10px;background:#120C06}
.bb-sub-h{display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap}
summary.bb-sub-h{cursor:pointer;list-style:none;margin-bottom:0}summary.bb-sub-h::-webkit-details-marker{display:none}summary.bb-sub-h::before{content:"▸";color:#E8C872;transition:transform .15s}.bb-sub[open]>summary.bb-sub-h{margin-bottom:8px}.bb-sub[open]>summary.bb-sub-h::before{transform:rotate(90deg)}
.bb-sub-h b{font-size:13px;color:#FFEB97}
.bb-opt{display:flex;gap:8px;align-items:center;margin-bottom:6px}
.bb-tag{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;border:1px solid #4A3720;background:#1D150C;color:#F4EBD0;font-size:12px;cursor:pointer;font-family:inherit}
.bb-tag.on{border-color:#E8C872;background:#2A1E10;color:#FFEB97}
`;
