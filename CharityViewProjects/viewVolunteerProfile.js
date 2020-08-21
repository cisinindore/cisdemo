import React, { Component } from 'react';
import { Meteor } from 'meteor/meteor';
import { Col } from 'react-bootstrap';
import AwatarReturn from '../../components/AwsImageDisplay';

class ViewVolunteer extends Component {
    constructor() {
        super();
        this.state = {           
          
        };
      }

    componentDidMount(){
        this.initialFunction();
    }

    initialFunction() {
                        var { volunteerid } = this.props;
                        Meteor.call("getVolunteerInfo", (volunteerid), (err, res) => {
                            
                            if(!err){
                                      this.setState({ volunteerData : res })
                                    }
                        })
                       }

    render(){
            return(
                <div>
                   
                        {
                            this.state.volunteerData !== undefined && this.state.volunteerData.length > 0 && this.state.volunteerData.map( (data) => {
                                let image = '';
                                let projectCompleted = 0;
                                let totalHoursWorked = 0;
                                let linkedIn = "NA";
                                let email="NA";
                                
                    
                                if( data.userData[0] !== undefined && data.userData[0].emails !== undefined &&  data.userData[0].emails[0].address !== undefined && data.userData[0].emails[0].address !==''){ email = data.userData[0].emails[0].address } 
                                if( data.userData[0] !== undefined && data.userData[0].profile !== undefined &&  data.userData[0].profile.avatar !== undefined && data.userData[0].profile.avatar !==''){ image = data.userData[0].profile.avatar }
                                if( data.completedProject !==0 && data.completedProject !==''){ projectCompleted = data.completedProject; }
                                if( data.hoursWorked !==0 && data.hoursWorked !==''){ totalHoursWorked = data.hoursWorked; }
                                if( data.userData[0].profile.linkedinUrl !== undefined && data.userData[0].profile.linkedinUrl !==""){ linkedIn = data.userData[0].profile.linkedinUrl;}
                                
                                return (
                                        <Col xs={12} md={4} className="rightBordered viewVolunteerProfile">

                                         
                                            { image !== undefined  ? <AwatarReturn avatarImage={image}/> : "" }
                                            <p className="viewProfileAcceptUserTitle">{data.userData[0].profile.firstName} {data.userData[0].profile.lastName} </p>
                                            <p className="leftSecSmallHead">Total Impact</p>

                                            <div className="rightImpactSection">
                                                <span>{projectCompleted}</span>
                                                Projects <br/>Completed
                                            </div>
                                            <div className="rightImpactSection">
                                                <span>{totalHoursWorked}</span>
                                                Hours <br/>Volunteered
                                            </div>
                                            <p className="leftSecSmallHead">Email Address</p>
                                            <div className="rightImpactSection">
                                            <a 
                                                          href={"mailto:" + email}
                                                          target="_blank"
                                                          >
                                                              {email}
                                                          </a>
                                                
                                            </div>

                                            <p className="leftSecSmallHead">WEBSITE</p>
                                            <div className="rightSectionLinkedIn">
                                                <img src="/images/linkedin_pop.png"/>
                                                {
                                                    linkedIn !=="NA" ? (
                                                        <a 
                                                          href={linkedIn}
                                                          target="_blank"
                                                          >
                                                              {linkedIn}
                                                          </a>
                                                    ) : ("NA")
                                                }


                                            </div>

                                            

                                        </Col>

                                        )


                            })
                        }
                    

                    
                    
                    {
                            this.state.volunteerData !== undefined && this.state.volunteerData.length > 0 && this.state.volunteerData.map( (data) => {
                                let aboutMe = 'NA';

                                if(data.userData[0].profile.aboutMe !== undefined &&  data.userData[0].profile.aboutMe !==''){ aboutMe = data.userData[0].profile.aboutMe; }
                            
                                
                                let allHistory = 'NA';                              

                                if(data.emplymentHistory !== undefined && data.emplymentHistory[0] !== undefined && data.emplymentHistory[0].EmploymentHistory )
                                {
                                    allHistory = data.emplymentHistory[0].EmploymentHistory.map((history)=>{
                                               return <div className="empHistoryBox"><p className="histTitle">{history.role} at {history.company}</p><p className="histTimeFrame">{history.timePeriod}</p><p className="histDescription">{history.description}</p></div>
                                            })

                                }
                                 

                             
                                
                                return (
                                        <Col xs={12} md={8} className="">
                                            <button className="charity-proj-view-profile" onClick={this.props.onClose}><img src="/images/close1.png"/></button>
                                            <p className="rightSectionFullName">About {data.userData[0].profile.firstName} {data.userData[0].profile.lastName}</p>
                                            <p className="rightFullBio">{aboutMe}</p><br/>

                                            <p className="rightSectionFullName">RECENT EMPLOYMENT HISTORY</p>
                                            {allHistory}
                                            

                                        </Col>

                                        )


          })}

                </div>
                
                );
            }


}
export default ViewVolunteer;