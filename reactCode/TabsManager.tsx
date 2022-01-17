import React from 'react';
import { makeStyles, Theme } from '@material-ui/core/styles';
import TabsSwitcher from "./TabsSwitcher";
 
export interface TabInfo {
  id:string;
  label:string;
  component:React.ReactChild;
}

export interface TabsManagerProps {
  tabs:TabInfo[];
  defaultTabId:string;
  contentAreaHeight:string;
} 

const TabsManager = ({tabs, defaultTabId, contentAreaHeight}:TabsManagerProps) => {
const useStyles = makeStyles((theme: Theme) => ({
  root: {
    flexGrow: 1
  },
  TabContentArea: {
    "height":contentAreaHeight,
    "overflow":"auto",    
    "width": "100%"
  }
}));
const classes = useStyles();
const [selectedTab, setSelectedTab] = React.useState<string>(defaultTabId);
const activeTab = tabs.find((tabInfo) => tabInfo.id === selectedTab)?.component

  return (
    <div className={classes.root}>
      <TabsSwitcher
        tabs={tabs.map( tab=> ({id:tab.id, label:tab.label})) }
        onTabChanged={setSelectedTab}
        activeTabHeaderId={selectedTab}
      />
      
      <div className={classes.TabContentArea}>
        {activeTab}
      </div>
      
    </div>
  );
}

export default TabsManager;