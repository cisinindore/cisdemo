import React, { useState, useEffect } from "react";
import {
  FlatList, StyleSheet, Text, TextInput,
  TouchableOpacity,
  View, offset,
  Image,
  Icon
} from "react-native";
import ChatItem from "../../components/chat/ChatItem";
import StompJS from '../../hooks/StompJSHook';
import { StompEventTypes, withStomp } from 'react-stompjs';
import * as ImagePicker from 'expo-image-picker';
import * as Permissions from 'expo-permissions';
import * as FileSystem from 'expo-file-system';
import { cos } from "react-native-reanimated";
import serverApi from '../../api/serverApi';

const ChatDetailScreen = (props) => {
  
  const [chatData, setChatData] = useState([{
    "message": "l", "sender": "John",
    "timestamp": "12:07 am"
  }]);
  const [msgData,setMsgData] = useState([]);
  const [newMsg,setNewMsg] = useState([]);
  const [inputMsg,setInputMsg] = useState('');
  const [imageFile,setImageFile] = useState('');
  const [filePath,setFilePath] = useState('');
 
  const [token, userID, userName, resultChatRoomID, initialise, StompCreateConnection, StompSubscribe,getOldMsg,
    StompSendMessage,callNewMsg,commonFunc,callSend] = StompJS(props,getData, getOldUsersList,fetchOldMsg,fetchNewMsg);

    function getData(data) {}
    function getOldUsersList(res){}

    async function fetchOldMsg(data){ 
      // console.log("details old msg calll-----------------",data)
      const msgData = await data;
      setMsgData(JSON.parse(msgData))
    }
  
  function fetchNewMsg(data){
    let isFlag = false;
    setNewMsg(data);
    return () => {
      isFlag = true;
    };
  }

  useEffect(() => {
    let propToken = props.route.params.chatRoomId.token;
    let propChatId = props.route.params.chatRoomId.chatId
    commonFunc('@storage_Login',propChatId);
    StompSubscribe(propChatId,'private',propToken,'A');
    getOldMsg(propChatId,propToken);
    setMsgData(props.route.params.data);
    setImageFile('');

  }, []);

  useEffect(()=>{
    if(msgData!==undefined && msgData.length>0){
      let tempArr = [];
      msgData.map(item=>{
            if(item.toUser==props.route.params.screenHeaderTitle || item.toUser==userName){             
              let date = item.date.split("T");
              let newTime = date[1].split(":");
              let obj;
              if(item.chatMessageType=="IMAGE")
              {
                try {
                  const response = serverApi.get('/api/media/download/',
                      {
                          headers: {
                              "Authorization":'Bearer ' + token,
                              "Content-Type": "application/json",
                              "responseType":"blob"
                          },
                          params:{'file':item.text}
                      },
                      ).then((response) => {                     
                          if(response.status === 200){
                            console.log("inside image ==============",response);
                            obj = { "message":response.request.responseURL, "sender": item.fromUser,"timestamp":newTime[0]+':'+newTime[1],
                            "msgType":item.chatMessageType};
                            tempArr.push(obj);
                          }
                      }).catch(err=>{
                          console.log("error in downloading file in chat msg====",err.response);
                      });
                    
                  } catch (error) {           
                      console.log("Error njjj" + error);
                  }
              }
              else{
                obj = { "message": item.text, "sender": item.fromUser,"timestamp":newTime[0]+':'+newTime[1],"msgType":item.chatMessageType};
                tempArr.push(obj);
              }
            }
        });
        setChatData(tempArr.reverse());
      
    }
  },[msgData]);

  useEffect(()=>{
    console.log("new msg set calll====================================================")
    if(newMsg!==undefined && newMsg.length>0){
      console.log('new msg-----------',JSON.parse(newMsg));
      let msg = [JSON.parse(newMsg)]
      let tempArr = [];
      msg.map(item=>{
              if(item.toUser==props.route.params.screenHeaderTitle || item.toUser==userName){
                let date = item.date.split("T");
                let newTime = date[1].split(":");
                let obj = { "message": item.text, "sender": item.fromUser,"timestamp":newTime[0]+':'+newTime[1]};
                tempArr.push(obj);
                // console.log("temp arr-----",tempArr)
              }
          });
          let arr = [...tempArr,...chatData];
          setChatData(arr);
    }
  },[newMsg]);

  const sendMessage = async() => {
    let flag = false;
    let msg;

    if(imageFile!==''){

      let formData = new FormData();    
      var filename = (filePath.uri).split(/[\\\/]/).pop();
      let uri = filePath.uri;
      let uriParts = uri.split('.');
      let fileType = uriParts[uriParts.length - 1];

      formData.append('file',{ type: `image/${fileType}`,
      name: filename,
      uri:uri});
      
      uploadAndSend(formData);

      setTimeout(() => {
        setImageFile('');
      }, 2000);
    }
    else{
      msg = {
        "username":userName,
        "chatRoomId":props.route.params.chatRoomId.chatId,
        "fromUser":userName,
        "toUser":props.route.params.screenHeaderTitle,
        "text":inputMsg.charAt(0).toLowerCase() + inputMsg.slice(1),
        "chatMessageType" : "TEXT"};
        callSend(msg,props.route.params.chatRoomId.chatId,'TEXT');
    }

    setTimeout(() => {
      flag= true;
      setInputMsg('');
    }, 2000);

  }

  const uploadAndSend = (imgFile) => {

    try {
      const response = serverApi.post('/api/media/upload/discussions',
          imgFile,
          {
              headers: {
                  'Authorization': 'Bearer ' + token,
                  "Content-Type": "multipart/form-data",
                  "discussionRoomId": props.route.params.chatRoomId.chatId,
                  "userId": userID
              }
          }
          ).then((response) => {                       
              if(response.status === 200){
                  if(response.data!==undefined && response.data!==null){
                    let msg = {
                      "username":userName,
                      "chatRoomId":props.route.params.chatRoomId.chatId,
                      "fromUser":userName,
                      "toUser":props.route.params.screenHeaderTitle,
                      "text":response.data.data,
                      "chatMessageType" : "IMAGE"};
                      callSend(msg,props.route.params.chatRoomId.chatId);
                  }
              }
          }).catch(err=>{
              console.log("error in uploading file in chat msg====",err,err.response);
          })      
      } catch (error) {           
          console.log("Error njjj" + error);
      }
  }

  const closeImg = () =>{
    setImageFile('');
  }

  const openImagePickerAsync = async () => {
    console.log("image picker called----");
    try{
    // let permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    // const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync;
    const permissionResult = Permissions.CAMERA_ROLL;
    const { status } = await Permissions.askAsync(permissionResult);

    console.log(permissionResult, status);
    if (status === false) {
      alert("Permission to access camera roll is required!");
      return;
    }
    else{
      let pickerResult = await ImagePicker.launchImageLibraryAsync();
      console.log(pickerResult);
      if (!pickerResult.cancelled) {
        console.log("image file-------------------",imageFile,pickerResult.uri)
        setImageFile(pickerResult.uri);
        setFilePath(pickerResult)
        // setImageFile(pickerResult);
      }
    }
  }
  catch(err){
    console.log("err in getting permission-------",err);
  }
    
  }

  return (
    <View
      style={styles.container}>

      <FlatList
        style={styles.list}
        inverted="true"
        data={chatData}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item, index }) => (
          <ChatItem
            key={index}
            message={item.message}
            type={item.msgType}
            timestamp={item.timestamp}
            user={userName}
            sender={item.sender}
            style={userName == item.sender ? "sent" : "received"}
          />
        )}
      />


      <View style={imageFile!=='' ? styles.footerFile : styles.footer}>
        {imageFile!=='' && <View style={styles.chatFile}>
              <Image source={{ uri: imageFile }} style={styles.chatFile}/>
              <TouchableOpacity onPress={closeImg}>
                <Image source={{ uri: "https://img.icons8.com/small/75/000000/cancel.png" }} style={styles.closeButton}/> 
              </TouchableOpacity>
              {/* <TouchableOpacity onPress={openImagePickerAsync}>
              <Image source={{ uri: "https://img.icons8.com/small/75/000000/attach.png" }} style={styles.iconSend} /> 
              </TouchableOpacity>  */}
        </View> }
        
        {imageFile=='' &&  
        <View style={styles.inputContainer}>           
            <TextInput style={styles.inputs}
              placeholder="Write a message..."
              underlineColorAndroid='transparent'
              onChangeText={(val) => setInputMsg(val)}
              value={inputMsg} /> 

              <TouchableOpacity onPress={()=>openImagePickerAsync()}>
                  <Image source={{ uri: "https://img.icons8.com/small/75/000000/attach.png" }} style={styles.iconSend} /> 
              </TouchableOpacity> 
        </View> }

        {/* <TouchableOpacity onPress={openImagePickerAsync} style={styles.btnSend}>
          <Image source={{ uri: "https://img.icons8.com/small/75/ffffff/filled-sent.png" }} style={styles.iconSend} />
        </TouchableOpacity> */}

        <TouchableOpacity onPress={()=>sendMessage()} style={styles.btnSend}>
          <Image source={{ uri: "https://img.icons8.com/small/75/ffffff/filled-sent.png" }} style={styles.iconSend} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  chatFile: {
    backgroundColor: 'transparent',
    borderRadius: 30,
    // borderBottomWidth: 1,
    height: 150,
    width:150 | '100%',
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  closeButton: {
    // position: 'absolute',
    // left: 0,
    // right: 0,
    // top: 0,
    // bottom: 0,
    width: 30,
    height: 30,
    marginTop:0
  },
  title: { // 4.
    marginTop: offset,
    marginLeft: offset,
    fontSize: offset,
  },
  buttonText: { // 5.
    marginLeft: offset,
    fontSize: offset,
  },
  container: {
    flex: 1
  },
  list: {
    paddingHorizontal: 17,
  },
  footer: {
    flexDirection: 'row',
    height: 60,
    backgroundColor: '#eeeeee',
    paddingHorizontal: 10,
    padding: 5,
  },
  footerFile:{
    flexDirection: 'row',
    height: 200,
    backgroundColor: '#eeeeee',
    paddingHorizontal: 10,
    padding: 5,
    alignItems:'center'
  },
  btnSend: {
    backgroundColor: "#00BFFF",
    width: 40,
    height: 40,
    borderRadius: 360,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSend: {
    width: 30,
    height: 30,
    alignSelf: 'center',
  },
  inputContainer: {
    borderBottomColor: '#F5FCFF',
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    borderBottomWidth: 1,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  inputs: {
    height: 40,
    marginLeft: 16,
    borderBottomColor: '#FFFFFF',
    flex: 1,
  },
  balloon: {
    maxWidth: 250,
    padding: 15,
    borderRadius: 20,
  },
  itemIn: {
    alignSelf: 'flex-start'
  },
  itemOut: {
    alignSelf: 'flex-end'
  },
  time: {
    alignSelf: 'flex-end',
    margin: 15,
    fontSize: 12,
    color: "#808080",
  },
  item: {
    marginVertical: 14,
    flex: 1,
    flexDirection: 'row',
    backgroundColor: "#eeeeee",
    borderRadius: 300,
    padding: 5,
  },
})

export default withStomp(ChatDetailScreen)