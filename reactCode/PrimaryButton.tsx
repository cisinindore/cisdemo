import React from "react";
import { Button } from "@material-ui/core";
import {Func} from "../../../types";
import { makeStyles } from "@material-ui/core/styles";

interface PrimaryButtonProps {
  onClick: Func;  
  disabled?: boolean;
  caption: string;

}
const useStyles = makeStyles((theme) => ({
  root: {
    minWidth:theme.typography.button.minWidth,
    height:theme.typography.button.height,
    borderRadius:theme.typography.button.borderRadius,
    backgroundColor:theme.palette.primary.main,
    fontSize:theme.typography.button.fontSize,
    boxShadow:"none",
    color:theme.palette.info.contrastText,
    "text-transform": "capitalize !important",
    '&:hover': {
        backgroundColor: theme.palette.primary.light,
        boxShadow: "none"
      }
  },
  disabled: {
      backgroundColor: "#d7dde4",
      color: "#b8bcce"
    }
}));

const PrimaryButton = ({
  onClick,  
  disabled,
  caption
}: PrimaryButtonProps) => {
  const classes = useStyles();
  return (
    <Button
      classes={classes}
      variant="contained"
      onClick={onClick}
      disabled={disabled}      
    >
      {caption}
    </Button>
  );
};

export default PrimaryButton;
