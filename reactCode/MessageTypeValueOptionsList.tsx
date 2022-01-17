import React from "react";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import TableCell from "@material-ui/core/TableCell";
import TableBody from "@material-ui/core/TableBody";
import StyledTable from "../../../common/components/toolkit-components/stylesTable/StyledTable";
import { makeStyles } from "@material-ui/core/styles";
import {ExtendedMessageTypeValueOption} from "./MessageTypeSemantics";
import MessageTypeValueOptionsListItemContainer from "./MessageTypeValueOptionsListItemContainer";
import {Func1} from "../../../common/types";

export interface MessageTypeValueOptionsListProps {
    messageTypeValueOptions:ExtendedMessageTypeValueOption[],
    addMessageTypeOption: Func1<string>,
    removeMessageTypeOption:Func1<string>,
    editMessageTypeLabel:Func1<ExtendedMessageTypeValueOption>
}

const useStyles = makeStyles({
    value:{
    padding: "0",
    width: "20px"
    }
});

const MessageTypeValueOptionsList = ({addMessageTypeOption, removeMessageTypeOption, editMessageTypeLabel, messageTypeValueOptions}: MessageTypeValueOptionsListProps) => {

    const classes = useStyles();
    const onItemToggle = (value:string, selected:boolean) => {
        if(selected) {
            addMessageTypeOption(value)
        }
        else {
            removeMessageTypeOption(value)
        }
    }

    return <>
        <StyledTable aria-label="simple table">
                <TableHead >
                    <TableRow>
                        <TableCell />
                        <TableCell className={classes.value}>Value</TableCell>
                        <TableCell/>
                        <TableCell>Frequency</TableCell>
                        <TableCell>Count</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {messageTypeValueOptions.map((item) => (
                        <MessageTypeValueOptionsListItemContainer
                            messageTypeValueOption={item}
                            toggleMessageTypeOption={(selected:boolean)=>onItemToggle(item.value, selected)}
                            editMessageTypeLabel={editMessageTypeLabel}
                        />))}
                </TableBody>
            </StyledTable>
    </>
};

export default MessageTypeValueOptionsList
