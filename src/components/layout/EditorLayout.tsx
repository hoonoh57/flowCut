import React from'react';
import{LeftPanel}from'./LeftPanel';
import{CenterArea}from'./CenterArea';
import{RightPanel}from'./RightPanel';
import{useEditorStore}from'../../stores/editorStore';
import{theme}from'../../styles/theme';
export const EditorLayout:React.FC=()=>{const lo=useEditorStore(s=>s.leftPanelOpen);const ro=useEditorStore(s=>s.rightPanelOpen);return(<div style={{display:'flex',width:'100%',height:'100%',background:theme.colors.bg.primary,overflow:'hidden'}}>{lo&&<div style={{width:280,minWidth:280,height:'100%',borderRight:`1px solid ${theme.colors.border.subtle}`,background:theme.colors.bg.secondary,display:'flex',flexDirection:'column'}}><LeftPanel/></div>}<div style={{flex:1,minWidth:0,height:'100%',display:'flex',flexDirection:'column'}}><CenterArea/></div>{ro&&<div style={{width:280,minWidth:280,height:'100%',borderLeft:`1px solid ${theme.colors.border.subtle}`,background:theme.colors.bg.secondary,display:'flex',flexDirection:'column'}}><RightPanel/></div>}</div>);};
