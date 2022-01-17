import React from 'react';
import ExpandableArea,{ExpandableAreaProps} from "../expandable-area/ExpandableArea";

export interface ExpandableAreaListProps {
    children : ExpandableAreaProps[] 
    headerComponent?:React.ReactNode   
}

const ExpandableAreaList = ({children, headerComponent}:ExpandableAreaListProps)=> {  
  return (
    <>
    {children.map(expandableArea=><ExpandableArea key={expandableArea.label} label={expandableArea.label} headerComponent={headerComponent}>{expandableArea.children}</ExpandableArea>)}
    </>
  );
}
export default ExpandableAreaList;
