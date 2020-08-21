import React, { Component } from 'react';
import { Meteor } from 'meteor/meteor';
import { Col } from 'react-bootstrap';
import { Bert } from 'meteor/themeteorchef:bert';
import StarRatings from 'react-star-ratings';
import AwatarReturn from '../../components/AwsImageDisplay';
import BackgroundReturn from '../../components/AwsCharityCoverImage';
import Style from '../UserDashboardProjects/style';
import StyledTab from '../BrowseProject/style';
import Tabstyle from '../Tabs/style';
import {prepareKeyDeliverablesForInput} from '../CharityProjects/utils'
import './style.css';

class ReviewVolunteerWork extends Component {
  constructor() {
    super();
    this.state = {
      workSubmitted:''
      // open: false,
      // lappArray:[],
      // openUserProfile : false
    };
  }
  // react lifecycle method
  componentDidMount() {
    this.getThisReviewDetails();
    this.getDownloadUrl();
  }

  // get details related to this project
  getThisReviewDetails = () => {
    const { reviewWorkVolunteerId, reviewWorkProjectId } = this.props;
    const obj = {};
    obj.volId = reviewWorkVolunteerId;
    obj.projId = reviewWorkProjectId;
    Meteor.call('getReviewDetails', obj, (err, res) => {
      if (!err) {
        this.setState({ reviewProjectWithData: res });
      }
    });
    Meteor.call('getWorkHistory', obj, (error, response) => {
      if (!error) {
        this.setState({ thisWorkData: response });
      }
    });
   
  };
  getDownloadUrl =()=>{
    const { reviewWorkVolunteerId, reviewWorkProjectId } = this.props;
    const obj = {};
    obj.volId = reviewWorkVolunteerId;
    obj.projId = reviewWorkProjectId;
    Meteor.call('getDownloadUrl', obj, (error, response) => {
      if (!error) {
        this.setState({ workSubmitted: response });
      }
    });

  }

  /**
   * handle the textarea field in review page, here chaity will
   * provide review on uploaded work of volunteer
   */

  holdTextarea = (e) => { if(e.target.value.length < 501){ this.setState({ givenReviewText : e.target.value, lengthOfField : e.target.value.length }) } }

  // Handle the checkbox value here
  handleCheckbox = (e) => {
    this.setState({ completedProject: e.target.checked });
  };

  // Submit the review form to messaging system
  submitProvideReviewForm = () => {
    const { getBackToView } = this.props;

    if (this.state.givenReviewText !== undefined || this.state.completedProject!==undefined) {
      // if (this.state.givenReviewText.length === 0 || this.state.completedProject===undefined || this.state.completedProject===false) {
      //   Bert.alert('Feedback detail required to send at volunteer end 1', 'danger'); 
      // }
      if((this.state.completedProject===false || this.state.completedProject===undefined) && (this.state.givenReviewText.length===0  || this.state.givenReviewText===undefined)){
        Bert.alert('Feedback detail required to send at volunteer end', 'danger'); 
      }
      else {
        console.log("call submit");
        const obj = {};
        obj.givenReviewText = this.state.givenReviewText;
        obj.projectId = this.props.reviewWorkProjectId;
        obj.volunteerId = this.props.reviewWorkVolunteerId;
        if(this.state.completedProject !== undefined) { obj.completedProject = this.state.completedProject; }
        Meteor.call("sendMessageToVolunteer", (obj), (err) => { if(!err){ Bert.alert('Feedback sent as message to volunteer', 'success'); getBackToView(); } })
      }
    }
   
    else{ Bert.alert('Feedback detail required to send at volunteer end', 'danger'); }
 }

 //get the signed aws-url of this clicked file
 handleObject = (fileId) => { Meteor.call("downloadObject",(fileId), (err, res) =>{ if( res.length > 0 ){ const win = window.open(res[0], '_blank'); win.focus(); } })}

  render() {
    const { getBackToView } = this.props;
    const {reviewProjectWithData} = this.state;    
    let link = '';
    let file = '';
    let commentByVolunteer = '';
    if( this.state.thisWorkData !== undefined )
    {
      if( this.state.thisWorkData.linkToFile !== undefined && this.state.thisWorkData.linkToFile !==''){ link = this.state.thisWorkData.linkToFile; }
      if( this.state.thisWorkData.imageInput !== undefined && this.state.thisWorkData.imageInput!==''){ file = this.state.thisWorkData.imageInput; }
      if( this.state.thisWorkData.formComment !== undefined && this.state.thisWorkData.formComment!==''){ commentByVolunteer = this.state.thisWorkData.formComment; }
    }
  

    return (
      <Style.innerWapper>
        <Col xs={12} md={4} className="rightBordered">
          <input
            type="button"
            value="&#60; Back to Projects"
            onClick={() => getBackToView()}
            className="backbtn"
          />
          <br />
          <br />
          <br />
          <Tabstyle.col100_new className="col50">
              { reviewProjectWithData !==undefined && reviewProjectWithData.map( (prData)=>{
                    let dateString = '';
                    let avatarImage = "";
                    let templateTitle = 'NA';
                    if (prData.projectData !== undefined) {
                      const date1 = new Date(prData.projectData.deadline);
                      dateString = `${date1.toLocaleDateString('en-US', { month: 'short', })} 
                                    ${date1.toLocaleDateString('en-US', { day: 'numeric', })},  
                                    ${date1.toLocaleDateString('en-US', { year: 'numeric' })}`;

                      if (prData.org.coverImage) {  avatarImage = prData.org.coverImage; }
                    }

                    if( prData.templateInfo!== undefined && prData.templateInfo[0]!== undefined && prData.templateInfo[0].templateTitle ){ templateTitle = prData.templateInfo[0].templateTitle; }
                    
                    let userDesignationAndCompany = '';                  
                    if(prData.historyData!== undefined ){
                      let HistoryLength = prData.historyData.EmploymentHistory.length;
                      let dummy_empHistory = prData.historyData.EmploymentHistory[HistoryLength-1];                      
                      userDesignationAndCompany = <p className="designationAndCompany">{ dummy_empHistory['role'] !== undefined && dummy_empHistory['role'] ? dummy_empHistory['role']+" at"  : "" }  { dummy_empHistory['company'] !== undefined && dummy_empHistory['company'] ? dummy_empHistory['company'] : "" }</p>
                    }
  
                return(
                      <div className="projectBox_new">
                        <StyledTab.projectBanner>
                            <StyledTab.BannerOverlay className="BannerOverlay"> { avatarImage !== undefined  ? <BackgroundReturn imagePath={avatarImage}/> : "" } </StyledTab.BannerOverlay>
                            <StyledTab.BannerCaption>
                            <div className="rightSectionOrgLogo"> {prData.org.avatar !== undefined && prData.org.avatar ? ( prData.org.avatar !== undefined  ? <AwatarReturn avatarImage={prData.org.avatar}/> : "" ) : ('NA')}</div>
                            <div className="rightSectionProjectTitle">
                              <h2 className="topProjectTitle">{prData.projectData.title}</h2>
                              <StyledTab.projectlabelbox className="projectlabelbox">                                                                                              
                                  { prData.cause !== undefined && prData.cause ? ( <StyledTab.projectlabel className="colorBagni">{prData.cause.name} </StyledTab.projectlabel>) : ('')}
                                  { prData.skill !== undefined &&  prData.skill ? ( <StyledTab.projectlabel2 style={{background: prData.skill.color}}>{prData.skill.name}</StyledTab.projectlabel2>) : ('')}
                              </StyledTab.projectlabelbox>
                            </div>
                            </StyledTab.BannerCaption>
                        </StyledTab.projectBanner>

                        <StyledTab.projectDetail className="projectDetail">
                            <StyledTab.projectHeading className="bottomProjectTitle">PROJECT DETAILS</StyledTab.projectHeading>
                            <ul className="projectDetailsBottomArea">
                                <li><img src="/images/web-development.png" /><p>{templateTitle}</p></li>
                                <li><img src="/images/time_tracking.png" /><p>{prData.projectData.hours} hours over {prData.projectData.days} days</p></li>
                                <li><img src="/images/deadline.png" /><p>Deadline: {dateString}</p></li>
                            </ul>                            
                        </StyledTab.projectDetail>

                        <StyledTab.projectDetail className="projectDetail projectImpact_accept">
                            <StyledTab.projectHeading className="projectImpact_head">Project Impact</StyledTab.projectHeading>
                            <p>{prData.projectData.impactStatement}</p>
                        </StyledTab.projectDetail>

                        <StyledTab.projectDetail className="projectDetail projectInfo_accept">
                            <StyledTab.projectHeading className="projectInfo_head">PROJECT INFO</StyledTab.projectHeading>
                            <div className="imgNdHead">
                              <div className="img"><img src="/images/key_deliverables.png" /> </div>
                              <div className="text"> <p>Key Deliverables</p></div>                            
                            </div>
                            <br/>
                            <ul>
                            {prData.projectData.keyDeliverables.map((key)=>{
                              return <li>{key}</li> ;
                              })}
                              </ul>
                            <br/>            
                        </StyledTab.projectDetail>


                        <div className="reviewProjectUserData">
                            <h2>SUBMITTED BY</h2>
                            { prData.user.profile.avatar !== undefined ? <AwatarReturn avatarImage={prData.user.profile.avatar}/> : "" }
                            <p>{prData.user.profile.firstName} {prData.user.profile.lastName}</p>
                            {userDesignationAndCompany}
                            <StarRatings rating={prData.userRating} starDimension="20px" starSpacing="0" starRatedColor="#F3DE6F" />
                        </div>
                      </div>
                    )
                 })
            }

          </Tabstyle.col100_new>
        </Col>

        <Col xs={12} md={8}>
          <h2 className="topApplicantTitle reviewMainTopHead">Review Submitted Work </h2>
          <Col xs={12} md={6}>
            <div className="reviewwork_give">
                  <label className="reviewwork_label">Submission Feedback <span>*</span></label>                
                  <p className="reviewwork_smalltext">Describe what changes you’d like to see in the work submitted. If no changes are needed, tick the statement below.</p>
                  <textarea className="reviewwork_textarea" value={this.state.givenReviewText} onChange={ (e)=> this.holdTextarea(e) }></textarea>
                  <div className="reviewwork_counterhold">{ this.state.lengthOfField !== undefined ? this.state.lengthOfField : "0"}/500</div>
                  <div className="reviewwork_orholder">
                    OR
                  </div>
                  <div className="reviewwork_checkbox">
                    <input type="checkbox" value="1"  onChange={ (e) => this.handleCheckbox(e) }/>
                    <p>I don’t need any changes to be made on the submitted work and mark this project as complete.</p>
                  </div>
            </div>
            <input type="button" value="SUBMIT" className="reviewwork_submitwork" onClick={ () => this.submitProvideReviewForm()}  />
          </Col>
          <Col xs={12} md={6}>
            <div className="reviewworkRightSection">              
              <label className="reviewwork_label">Link</label>                
              <input type="text" placeholder="" className="reviewwork_submttedLink" value={link!=='' ? link : "NA"} title={link!=='' ? link : "No link uploaded by volunteer"}/>
              { link !=='' ?  ( <div> <div className="reviewwork_orholder">OR</div> <a value="DOWNLOAD" className="reviewwork_downloadBtn" href={link!=='' ? link : ""} target="_blank" title={link!=='' ? link : "No link uploaded by volunteer"} >DOWNLOAD</a></div> ) : ("") }

            <label className="reviewwork_label">Uploaded File</label>
       {this.state.workSubmitted ?(<a href={this.state.workSubmitted} target="_blank">{this.state.workSubmitted}</a>): (<p className="No data available">No data available</p>) }
              {/* { file !== "" ?  (  <a href="javascript:void(0)" title="click to open this image" onClick={()=>this.handleObject(file)} > { file !== undefined ? <AwatarReturn avatarImage={file}/> : "" } </a> ) : (<p className="No data available">No data available</p>) } */}
              <label className="reviewwork_label">Task details send by volunteer</label>
              { commentByVolunteer !== '' ? ( <div className="reviewWork_uploadedText"> {commentByVolunteer} </div>) : (<p className="No data available">No data available</p>)}
            </div>
          </Col>
        </Col>
      </Style.innerWapper>
    );
  }
}
ReviewVolunteerWork.defaultProps = { thiOrgLogo: '', thisProCat: '', tihsProjSubCat: '' };
export default ReviewVolunteerWork;
