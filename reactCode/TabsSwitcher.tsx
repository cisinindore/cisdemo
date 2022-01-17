import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import AppBar from '@material-ui/core/AppBar';
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';

export interface TabHeaderInfo {
    id:string;
    label:string;
}

export interface TabsSwitcherProps {
    tabs:TabHeaderInfo[];
    onTabChanged: (tabId:string) => void;
    activeTabHeaderId:string;
} 
 
const useStyles = makeStyles((theme) => ({
  tabsRoot: {
    backgroundColor: theme.palette.info.contrastText,
    '& .MuiTab-textColorInherit':{
        "margin": "5px 23px 5px 23px",
        "font-family": theme.typography.fontFamily,
        "font-size": theme.typography.subtitle1.fontSize,
        "font-weight": "bold",
        "font-stretch": "normal",
        "font-style": "normal",
        "line-height": "1.67",
        "letter-spacing": "normal",
        "text-align": "left",
        "color": "#13225e",
        '&:hover':{
            color: `${theme.palette.primary.main} !important`
        },
    },
    '& .MuiTab-textColorInherit.Mui-selected':{
        color: `${theme.palette.primary.main} !important`
    },
    '& .MuiTabs-indicator':{
      "background-color":theme.palette.primary.main,      
    }
  },
  paperRoot:{
    "box-shadow": "none",
    "border-bottom": "1px solid #e5e8eb"
  },
  tabRoot:{
    "text-transform":"initial",
    "margin": "5px 5px 5px 5px !important",    
    "min-width": "106px"
  }
}));

const TabsSwitcher = ({
    tabs,
    onTabChanged,
    activeTabHeaderId
}:TabsSwitcherProps) => {
  const classes = useStyles();
  const handleChange = (event: React.ChangeEvent<{}>, newValue: string) => {
    onTabChanged(newValue);
  };
 
  return (
      <AppBar position="static" classes={{root:classes.paperRoot}}>
        <Tabs 
          value={activeTabHeaderId}
          onChange={handleChange}          
          classes={{root:classes.tabsRoot}}
        >
            { tabs.map((thisTab) => <Tab classes={{root: classes.tabRoot}} value={thisTab.id} key={thisTab.id} label={thisTab.label} /> ) }          
        </Tabs>
      </AppBar>    
  );
}

export default TabsSwitcher;