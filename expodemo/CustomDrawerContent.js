import React, { useEffect,useState } from "react";
import { View, Image, StyleSheet, Text,TouchableOpacity } from "react-native";
import { DrawerContentScrollView, DrawerItem } from "@react-navigation/drawer";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import serverApi from '../../api/serverApi';
import * as ImagePicker from 'expo-image-picker';
import * as Permissions from 'expo-permissions';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CustomDrawerContent = (props) => {
  const [token, setToken] = useState('');
  const [userID, setUserID] = useState('');
  const [username,setUserName] = useState('');
  const [imageFile,setImageFile] = useState('');

  const initialise = async () =>{
    const keys = await AsyncStorage.getItem('@storage_Login');
    setToken(JSON.parse(keys).token);
    setUserID(JSON.parse(keys).id)
    setUserName(JSON.parse(keys).username)
  }

  const openImagePickerAsync = async () => {
   
    try{
    const permissionResult = Permissions.CAMERA_ROLL;
    const { status } = await Permissions.askAsync(permissionResult);

    if (status === false) {
      alert("Permission to access camera roll is required!");
      return;
    }
    else{
      const pickerResult = await ImagePicker.launchImageLibraryAsync();
      console.log(pickerResult);
      if (!pickerResult.cancelled) {
        setImageFile(pickerResult.uri);
        var filename = (pickerResult.uri).split(/[\\\/]/).pop();
        let uri = pickerResult.uri;
        let uriParts = uri.split('.');
        let fileType = uriParts[uriParts.length - 1];

        let formData = new FormData();
        let photo = {
          type: `image/${fileType}`,
          name: `photo.${fileType}`,
          uri:uri
        };
 
        formData.append('file',{ type: `image/${fileType}`,
        name: `photo.${fileType}`,
        uri:uri});
        
        const response = serverApi.post('/api/media/upload/user',
        formData,
        {
            headers: {
                'Authorization': 'Bearer ' + token,
                "Content-Type": "multipart/form-data",
                "userId": userID
            }
        }
        )
        .then((response) => { 
            console.log("response of upload--------",response.data)
        }).catch(err=>{
          setImageFile('');
          console.log("error ccc in uploading profile pic-----",err,err.response)
        })
      }
    }
  }
  catch(err){
    console.log("err in getting permission-------",err);
  }
    
  }

  useEffect(()=>{
    initialise();
  },[])

  return (
    <View style={styles.drawerWrapper}>
      <DrawerContentScrollView
        {...props}
        contentContainerStyle={styles.scrollView}
      >
        <View style={styles.myAccount}>
        <View>
          <Image
            source={{
              uri:imageFile!=='' ? imageFile :
                "https://cdn5.vectorstock.com/i/1000x1000/92/84/avatar-men-icon-flat-style-vector-10809284.jpg",
            }}
            style={{
              height: 60,
              width: 60,
              resizeMode: "cover",
              borderRadius: 30,
              marginBottom: 15
            }}
          />
          
          <TouchableOpacity style={{position:'absolute',left:45}} onPress={openImagePickerAsync}>
                <Image source={{uri: "https://img.icons8.com/small/75/000000/edit.png" }} 
                style={styles.editButton}/> 
          </TouchableOpacity>
          </View>

          <View style={styles.myAccountText}>
            <Text style={{ fontSize: 16, fontWeight: "500" }}>{username!==undefined ? username :''}</Text>
            <Text style={{ fontSize: 12 }}>Republican</Text>
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <DrawerItem
            label="My Account"
            icon={({ focused, color, size }) => (
              <MaterialCommunityIcons
                name="account-circle"
                color={color}
                size={size}
                style={{ width: 30, marginLeft: -3, marginRight: 3 }}
              />
            )} 
            style={styles.drawerItem}
          />
          <View style={styles.menuSeparator}></View>
          <DrawerItem
            label="Preferences"
            icon={({ focused, color, size }) => (
              <Ionicons
                color={color}
                name="ios-settings"
                size={size}
                style={{ width: 30 }}
              />
            )}
            style={{ ...styles.drawerItem }}
          />
          <View style={styles.menuSeparator}></View>
          <DrawerItem
            label="Help & Support"
            icon={({ focused, color, size }) => (
              <Ionicons
                color={color}
                name="md-help-circle"
                size={size}
                style={{ width: 30 }}
              />
            )}
            style={{ ...styles.drawerItem }}
          />
          <View style={styles.menuSeparator}></View>
        </View>
      </DrawerContentScrollView>
      <View style={styles.bottomContent}>
        <DrawerItem
          label="Sign Out"
          icon={({ focused, color, size }) => (
            <MaterialCommunityIcons
              color={color}
              name="account-off"
              size={size}
              style={{ width: 30 }}
            />
          )}
          style={{ ...styles.drawerItem, borderBottomWidth: 0 }}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  editButton : {
    width: 18,
    height: 18
  },
  drawerWrapper: {
    flex: 1,
    backgroundColor: "#d5ede1",
    paddingTop: 10,
    paddingBottom: 30,
    height: "100%",
    width: "100%",
  },
  scrollView: {
    width: "100%",
  },
  myAccount: {
    flexDirection: "column",
    paddingBottom: 10,
    marginBottom: 20,
    alignItems: "flex-start",
    borderBottomWidth: 1,
    borderBottomColor: "#5DD29B",
    paddingHorizontal: 30,
    shadowOffset: { width: 0, height: 3 },
    shadowColor: "#586069",
    shadowOpacity: 0.5,
    position:"relative"
  },
  myAccountText: {
    flexDirection: "column",
  },
  drawerItem: {
    paddingRight: 0,
    marginHorizontal: 0,
    paddingHorizontal: 20,
    width: "100%",
  },
  menuSeparator: {
    borderBottomWidth: 1,
    borderBottomColor: "#fff",
  },
  bottomContent: {
    bottom: 0,
  },
});

export default CustomDrawerContent;
